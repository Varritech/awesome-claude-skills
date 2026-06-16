/**
 * Resend API client.
 *
 * Replaces the Mailforge integration for domain authentication and email
 * sending. We hit the REST API directly (no SDK dependency) so the client
 * stays light and easy to mock in tests.
 *
 * Base URL: https://api.resend.com
 * Auth:     `Authorization: Bearer <RESEND_API_KEY>`
 * Docs:     https://resend.com/docs/api-reference
 *
 * The API key needs the "Full Access" scope to call /domains endpoints.
 * A send-only key (the default new-key scope) will 401 against /domains.
 * Sending endpoints work with either scope.
 */

export class ResendNotConfiguredError extends Error {
  constructor() {
    super('RESEND_API_KEY is not set. Add it in Vercel environment variables.');
    this.name = 'ResendNotConfiguredError';
  }
}

const BASE = 'https://api.resend.com';

function apiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ResendNotConfiguredError();
  return key;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Resend ${method} ${path} → ${res.status}: ${text}`);
  }

  // Some Resend DELETE endpoints return empty bodies on success; tolerate that.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Domains ─────────────────────────────────────────────────────────────────

export type ResendDnsRecordType = 'SPF' | 'DKIM' | 'MX' | 'TXT' | 'CNAME';
export type ResendDomainStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'temporary_failure';

export interface ResendDnsRecord {
  record: ResendDnsRecordType;
  name: string;
  type: 'TXT' | 'MX' | 'CNAME';
  ttl: string | number;
  status: 'not_started' | 'pending' | 'verified' | 'failed';
  value: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: ResendDomainStatus;
  region: string;
  created_at: string;
  records?: ResendDnsRecord[];
}

export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Add a domain to Resend so it can be authenticated and used as a From
 * address. Returns the DNS records the customer needs to publish.
 */
export async function createDomain(
  name: string,
  region: 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1' = 'us-east-1',
): Promise<ResendDomain> {
  return req<ResendDomain>('POST', '/domains', { name, region });
}

/** Fetch a domain by ID. The response includes the current DNS records and status. */
export async function getDomain(id: string): Promise<ResendDomain> {
  return req<ResendDomain>('GET', `/domains/${id}`);
}

/** Trigger Resend to recheck the DNS records and update each record's status. */
export async function verifyDomain(id: string): Promise<ResendDomain> {
  return req<ResendDomain>('POST', `/domains/${id}/verify`);
}

/** Remove a domain. Used during account deletion and migration cleanup. */
export async function deleteDomain(id: string): Promise<void> {
  await req<void>('DELETE', `/domains/${id}`);
}

// ─── Sending ─────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Send a single email. The From address must use a domain that has been
 * added to Resend AND has all DNS records verified.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return req<SendEmailResult>('POST', '/emails', input);
}
