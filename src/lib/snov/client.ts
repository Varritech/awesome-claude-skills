/**
 * Snov.io API client.
 *
 * Snov.io provides email finding, verification, and prospect search.
 * Base URL: https://api.snov.io/v1
 * Auth: OAuth2 access token obtained from client_id + client_secret.
 *
 * Set SNOV_CLIENT_ID and SNOV_CLIENT_SECRET in Vercel env to enable live calls.
 * Tokens expire after 3600s — we fetch a fresh one per server cold-start and
 * cache it in module scope for the lifetime of the serverless instance.
 */

export class SnovNotConfiguredError extends Error {
  constructor() {
    super('SNOV_CLIENT_ID and SNOV_CLIENT_SECRET are not set. Configure them in Vercel environment variables.');
    this.name = 'SnovNotConfiguredError';
  }
}

const BASE = 'https://api.snov.io/v1';

// Module-level token cache (lives for the serverless instance lifetime)
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new SnovNotConfiguredError();
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;

  const { clientId, clientSecret } = credentials();
  const res = await fetch(`${BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Snov token fetch → ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = data.access_token;
  // Expire 60s early to avoid edge-case expiry mid-request
  _tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return _cachedToken;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Snov ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SnovProspect {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailStatus?: string; // 'valid' | 'unverifiable' | 'invalid'
  currentCompany?: string;
  currentTitle?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  phone?: string;
}

export interface SnovSearchParams {
  position?: string[];    // job titles
  industry?: string[];
  location?: string[];
  limit?: number;
  lastId?: number;        // cursor for pagination
}

export interface SnovSearchResponse {
  success: boolean;
  data: SnovProspect[];
  total_count?: number;
  last_id?: number;
}

export interface SnovEmailVerifyResult {
  email: string;
  status: string;       // 'valid' | 'unverifiable' | 'invalid'
  smtpStatus?: string;
  mxFound?: boolean;
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Search for prospects using the Snov prospect search API.
 * Supports filtering by title (position), industry, and location.
 */
export async function searchProspects(params: SnovSearchParams): Promise<SnovSearchResponse> {
  const body: Record<string, unknown> = {
    rows: params.limit ?? 50,
  };
  if (params.position?.length) body.position = params.position;
  if (params.industry?.length) body.industry = params.industry;
  if (params.location?.length) body.location = params.location;
  if (params.lastId) body.lastId = params.lastId;

  return req<SnovSearchResponse>('POST', '/prospect-search', body);
}

/**
 * Verify a single email address via Snov's email verifier.
 */
export async function verifyEmail(email: string): Promise<SnovEmailVerifyResult> {
  return req<SnovEmailVerifyResult>('POST', '/get-emails-verification-status', { emails: [email] });
}

/**
 * Find email addresses for a person by name + domain.
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<{ emails: Array<{ email: string; emailStatus: string }> }> {
  return req('POST', '/get-emails-from-names', {
    firstName,
    lastName,
    domain,
  });
}

export function isConfigured(): boolean {
  return Boolean(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET);
}
