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

const BASE = 'https://api.snov.io';

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
  const res = await fetch(`${BASE}/v1/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
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
 * Search for prospects by domain using Snov's async domain-search API (v2).
 * Step 1: POST to start the search, get a task_hash.
 * Step 2: GET results using the task_hash.
 */
export async function searchProspectsByDomain(
  domain: string,
  positions?: string[],
  page = 1,
): Promise<SnovSearchResponse> {
  // Step 1: start the search
  const startRes = await req<{ task_hash?: string; success?: boolean }>(
    'POST',
    '/v2/domain-search/prospects/start',
    { domain, positions: positions ?? [], page },
  );

  const taskHash = startRes.task_hash;
  if (!taskHash) return { success: false, data: [] };

  // Step 2: poll for results (max 5 attempts, 1s apart)
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const result = await req<SnovSearchResponse>(
        'GET',
        `/v2/domain-search/prospects/result/${taskHash}`,
      );
      if (result.data?.length) return result;
    } catch {
      // still processing
    }
  }

  return { success: false, data: [] };
}

/**
 * Generic prospect search — Snov does not expose a public industry/location search API.
 * Returns empty so the leads route falls through to ALeads for browsing.
 */
export async function searchProspects(_params: SnovSearchParams): Promise<SnovSearchResponse> { // eslint-disable-line @typescript-eslint/no-unused-vars
  return { success: false, data: [] };
}

/**
 * Verify a single email address via Snov's email verifier.
 */
export async function verifyEmail(email: string): Promise<SnovEmailVerifyResult> {
  return req<SnovEmailVerifyResult>('POST', '/v1/get-emails-verification-status', { emails: [email] });
}

/**
 * Find email addresses for a person by name + domain.
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<{ emails: Array<{ email: string; emailStatus: string }> }> {
  return req('POST', '/v1/get-emails-from-names', {
    firstName,
    lastName,
    domain,
  });
}

export function isConfigured(): boolean {
  return Boolean(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET);
}
