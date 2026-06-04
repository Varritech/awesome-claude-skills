/**
 * Mailforge API client.
 *
 * Base URL: https://api.mailforge.ai/public
 * Auth: `Authorization: <raw key>` header (no Bearer prefix, no X-API-Key).
 * Key generated in Mailforge Settings → API.
 *
 * Mailforge is a domain + mailbox provisioning service — it purchases and
 * manages domains on behalf of the workspace, and provisions mailboxes on
 * those domains. DNS records (SPF/DKIM/DMARC/MX) are auto-configured.
 *
 * Set MAILFORGE_API_KEY in Vercel env to enable live calls. Without it,
 * isConfigured() returns false and callers gracefully degrade.
 */

export class MailforgeNotConfiguredError extends Error {
  constructor() {
    super('MAILFORGE_API_KEY is not set. Configure it in Vercel environment variables.');
    this.name = 'MailforgeNotConfiguredError';
  }
}

const BASE = 'https://api.mailforge.ai/public';

function apiKey(): string {
  const key = process.env.MAILFORGE_API_KEY;
  if (!key) throw new MailforgeNotConfiguredError();
  return key;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey(),
      'X-Source': 'convergeflow',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Mailforge ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Domain types ────────────────────────────────────────────────────────────

export interface MailforgeDnsRecord {
  type: string;
  host: string;
  value: string;
}

export interface MailforgeDomain {
  id: string;
  domain: string;
  status: string;         // e.g. "active", "pending"
  forwardingStatus?: string;
  autoRenew?: boolean;
  dnsRecords?: {
    spf?: MailforgeDnsRecord;
    dkim?: MailforgeDnsRecord;
    dmarc?: MailforgeDnsRecord;
    mx?: MailforgeDnsRecord;
  };
}

export interface MailforgeMailbox {
  id: string;
  email: string;
  domainId?: string;
  status: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

// ─── Domain operations ───────────────────────────────────────────────────────

/** List all domains in the workspace. */
export async function listDomains(): Promise<MailforgeDomain[]> {
  const res = await req<MailforgeDomain[] | { data: MailforgeDomain[] }>('GET', '/domains');
  return Array.isArray(res) ? res : res.data;
}

/** Purchase/register a new domain through Mailforge. */
export async function purchaseDomain(domain: string, workspaceId?: string): Promise<MailforgeDomain> {
  return req<MailforgeDomain>('POST', '/domains', {
    domains: [domain],
    ...(workspaceId ? { workspaceId } : {}),
  });
}

/** Get DNS records for a specific domain. */
export async function getDomainDns(domainId: string): Promise<MailforgeDnsRecord[]> {
  const res = await req<MailforgeDnsRecord[] | { data: MailforgeDnsRecord[] }>('GET', `/domains/${domainId}/dns`);
  return Array.isArray(res) ? res : res.data;
}

// ─── Mailbox operations ──────────────────────────────────────────────────────

/** List all mailboxes, optionally filtered by domain. */
export async function listMailboxes(domainId?: string): Promise<MailforgeMailbox[]> {
  const qs = domainId ? `?domainId=${domainId}` : '';
  const res = await req<MailforgeMailbox[] | { data: MailforgeMailbox[] }>('GET', `/mailboxes${qs}`);
  return Array.isArray(res) ? res : res.data;
}

/** Get a single mailbox by ID. */
export async function getMailbox(mailboxId: string): Promise<MailforgeMailbox> {
  return req<MailforgeMailbox>('GET', `/mailboxes/${mailboxId}`);
}

/** Purchase new mailboxes (Mailforge creates the email accounts). */
export async function purchaseMailboxes(
  domainIds: string[],
  count: number,
): Promise<MailforgeMailbox[]> {
  const res = await req<MailforgeMailbox[] | { data: MailforgeMailbox[] }>('POST', '/mailboxes', {
    domainIds,
    count,
  });
  return Array.isArray(res) ? res : res.data;
}

// ─── Workspace operations ────────────────────────────────────────────────────

export interface MailforgeWorkspace {
  id: string;
  name: string;
}

export async function listWorkspaces(): Promise<MailforgeWorkspace[]> {
  const res = await req<MailforgeWorkspace[] | { data: MailforgeWorkspace[] }>('GET', '/workspaces');
  return Array.isArray(res) ? res : res.data;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return Boolean(process.env.MAILFORGE_API_KEY);
}
