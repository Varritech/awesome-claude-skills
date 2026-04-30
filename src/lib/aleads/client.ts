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

const BASE = 'https://api.a-leads.co/gateway/v1';

function apiKey(): string {
  const key = process.env.ALEADS_API_KEY?.trim();
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
  // Raw ALeads field names returned by the API
  member_id?: number;
  member_name_last?: string;
  member_full_name?: string;
  job_title?: string;
  company_name?: string;
  domain?: string;
  member_location_raw_address?: string;
  member_picture_url?: string;
  email_found?: boolean;
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
 * Search for contacts via advanced-search.
 * POST /gateway/v1/search/advanced-search
 */
const DEFAULT_INDUSTRIES = ['Roofing', 'Solar', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'Cleaning'];

export async function searchContacts(params: ALeadsSearchParams): Promise<ALeadsSearchResponse> {
  const advanced_filters: Record<string, unknown> = {};
  advanced_filters.company_industry = params.industry ? [params.industry] : DEFAULT_INDUSTRIES;
  if (params.location) advanced_filters.person_location = [params.location];
  if (params.title?.length) advanced_filters.person_seniority = params.title;

  const raw = await req<{ data?: ALeadContact[]; total?: number; current_page?: number; meta_data?: { total_count?: number } }>(
    'POST',
    '/search/advanced-search',
    { advanced_filters, current_page: params.page ?? 1, search_type: 'new' },
  );

  // Log first contact shape so we can see all raw field names
  if (raw.data?.[0]) {
    console.log('[aleads] first contact raw keys:', Object.keys(raw.data[0]));
    console.log('[aleads] first contact sample:', JSON.stringify(raw.data[0]));
  }

  // Normalize raw ALeads field names to the canonical shape
  const data = (raw.data ?? []).map((c) => ({
    ...c,
    id: String(c.member_id ?? c.id ?? Math.random()),
    first_name: c.first_name ?? (c.member_full_name?.split(' ')[0]),
    last_name: c.last_name ?? c.member_name_last ?? (c.member_full_name?.split(' ').slice(1).join(' ')),
    company: c.company ?? c.company_name,
    title: c.title ?? c.job_title,
    location: c.location ?? c.member_location_raw_address,
    linkedin_url: c.linkedin_url,
  }));

  return {
    data,
    total: raw.total ?? raw.meta_data?.total_count ?? 0,
    page: raw.current_page ?? 1,
    limit: params.limit ?? 50,
  };
}

export function isConfigured(): boolean {
  return Boolean(process.env.ALEADS_API_KEY);
}
