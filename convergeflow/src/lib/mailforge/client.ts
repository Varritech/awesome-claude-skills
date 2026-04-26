/**
 * Mailforge API client.
 *
 * Base URL and auth: https://app.mailforge.ai — authenticated via
 * X-API-Key header using the key from Settings → API.
 *
 * API access requires an active Slots subscription on the workspace.
 * Set MAILFORGE_API_KEY in Vercel env to enable live calls.
 * Without it, all methods throw MailforgeNotConfiguredError so callers
 * can decide whether to fall back to placeholder behaviour.
 */

export class MailforgeNotConfiguredError extends Error {
  constructor() {
    super('MAILFORGE_API_KEY is not set. Configure it in Vercel environment variables.');
    this.name = 'MailforgeNotConfiguredError';
  }
}

const BASE = 'https://app.mailforge.ai/api';

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
      'X-API-Key': apiKey(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Mailforge API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Domain types ────────────────────────────────────────────────────────────

export interface MailforgeDomain {
  id: string;
  domain: string;
  status: string;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  mxValid: boolean;
  dnsRecords?: {
    spf?: { host: string; type: string; value: string };
    dkim?: { host: string; type: string; value: string };
    dmarc?: { host: string; type: string; value: string };
    mx?: { host: string; type: string; value: string };
  };
}

export interface MailforgeMailbox {
  id: string;
  email: string;
  domainId: string;
  status: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
}

// ─── Domain operations ───────────────────────────────────────────────────────

export async function createDomain(domain: string): Promise<MailforgeDomain> {
  return req<MailforgeDomain>('POST', '/domains', { domain });
}

export async function getDomain(domainId: string): Promise<MailforgeDomain> {
  return req<MailforgeDomain>('GET', `/domains/${domainId}`);
}

export async function verifyDomain(domainId: string): Promise<MailforgeDomain> {
  return req<MailforgeDomain>('POST', `/domains/${domainId}/verify`);
}

export async function listDomains(): Promise<MailforgeDomain[]> {
  const res = await req<{ data: MailforgeDomain[] } | MailforgeDomain[]>('GET', '/domains');
  return Array.isArray(res) ? res : res.data;
}

// ─── Mailbox operations ──────────────────────────────────────────────────────

export async function createMailbox(domainId: string, username: string): Promise<MailforgeMailbox> {
  return req<MailforgeMailbox>('POST', '/mailboxes', { domainId, username });
}

export async function getMailbox(mailboxId: string): Promise<MailforgeMailbox> {
  return req<MailforgeMailbox>('GET', `/mailboxes/${mailboxId}`);
}

export async function listMailboxes(domainId?: string): Promise<MailforgeMailbox[]> {
  const qs = domainId ? `?domainId=${domainId}` : '';
  const res = await req<{ data: MailforgeMailbox[] } | MailforgeMailbox[]>('GET', `/mailboxes${qs}`);
  return Array.isArray(res) ? res : res.data;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return Boolean(process.env.MAILFORGE_API_KEY);
}
