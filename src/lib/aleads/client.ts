/**
 * A-Leads API client (a-leads.co).
 *
 * A-Leads provides B2B lead data via a REST API.
 * Set ALEADS_API_KEY in Vercel env to enable live calls.
 *
 * Endpoint: https://api.a-leads.co/v1
 * Auth: X-API-Key header
 */

export class ALeadsNotConfiguredError extends Error {
  constructor() {
    super('ALEADS_API_KEY is not set. Configure it in Vercel environment variables.');
    this.name = 'ALeadsNotConfiguredError';
  }
}

const BASE = 'https://api.a-leads.co/v1';

function apiKey(): string {
  const key = process.env.ALEADS_API_KEY;
  if (!key) throw new ALeadsNotConfiguredError();
  return key;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`A-Leads ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ALeadContact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  linkedin_url?: string;
  phone?: string;
  confidence?: number;
}

export interface ALeadsSearchParams {
  industry?: string;
  location?: string;
  title?: string[];
  limit?: number;
  page?: number;
}

export interface ALeadsSearchResponse {
  data: ALeadContact[];
  total: number;
  page: number;
  limit: number;
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Search for contacts matching the given criteria.
 * Returns up to `limit` leads (default 50, max 200 per page).
 */
export async function searchContacts(params: ALeadsSearchParams): Promise<ALeadsSearchResponse> {
  const qs = new URLSearchParams();
  if (params.industry) qs.set('industry', params.industry);
  if (params.location) qs.set('location', params.location);
  if (params.title?.length) params.title.forEach((t) => qs.append('title[]', t));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.page) qs.set('page', String(params.page));

  return req<ALeadsSearchResponse>('GET', `/contacts?${qs}`);
}

export function isConfigured(): boolean {
  return Boolean(process.env.ALEADS_API_KEY);
}
