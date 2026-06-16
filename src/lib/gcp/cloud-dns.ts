/**
 * Cloud DNS client — managed zones + record-set CRUD.
 *
 * API docs: https://cloud.google.com/dns/docs/reference/v1
 *
 * Used to host DNS for any domain ConvergeFlow registers via Cloud Domains.
 * After Resend issues SPF/DKIM/DMARC records, we write them into the zone
 * here so the customer never has to touch DNS themselves.
 */

import { getAuth, getProjectId } from './auth';

const BASE = 'https://dns.googleapis.com/dns/v1';

export interface CloudDnsResourceRecord {
  /** FQDN trailing dot required by the API. */
  name: string;
  /** TTL in seconds. */
  ttl: number;
  /** "A", "AAAA", "MX", "TXT", "CNAME", "NS", etc. */
  type: string;
  /** One rrdata per record value. MX records prefix with priority, e.g. "10 mx.example.com." */
  rrdatas: string[];
}

export interface CloudDnsManagedZone {
  name: string;
  dnsName: string;
  description?: string;
  nameServers?: string[];
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('GCP access token unavailable');

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`CloudDNS ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function projectPath(): string {
  return `/projects/${getProjectId()}`;
}

/** Ensure the trailing dot every Cloud DNS record name requires. */
function fqdn(name: string): string {
  return name.endsWith('.') ? name : `${name}.`;
}

/**
 * Create a managed zone for a domain. Idempotent: returns the existing
 * zone if one with the same `name` already exists.
 *
 * The Cloud DNS `name` field must be globally unique within the project
 * and is constrained to lower-case alphanumerics + hyphens, so we derive
 * it from the domain by replacing dots with hyphens.
 */
export async function ensureManagedZone(domain: string): Promise<CloudDnsManagedZone> {
  const zoneName = `cf-${domain.replace(/\./g, '-')}`;
  const dnsName = fqdn(domain);

  try {
    return await authedFetch<CloudDnsManagedZone>(`${projectPath()}/managedZones/${zoneName}`);
  } catch (err) {
    if (!String(err).includes('404')) throw err;
  }

  return authedFetch<CloudDnsManagedZone>(`${projectPath()}/managedZones`, {
    method: 'POST',
    body: JSON.stringify({
      name: zoneName,
      dnsName,
      description: `ConvergeFlow sending zone for ${domain}`,
      visibility: 'public',
    }),
  });
}

/**
 * Apply a set of records to a managed zone. Replaces existing records of
 * the same name+type so re-running is safe (e.g. after Resend rotates a
 * DKIM key).
 */
export async function upsertRecords(
  zoneName: string,
  records: CloudDnsResourceRecord[],
): Promise<void> {
  if (records.length === 0) return;

  // Look up existing record sets so we can issue a delete in the same
  // change batch. Cloud DNS rejects adds that conflict with existing
  // records, so we always replace.
  interface ListRecordSetsResponse {
    rrsets?: CloudDnsResourceRecord[];
  }
  const existing = await authedFetch<ListRecordSetsResponse>(
    `${projectPath()}/managedZones/${zoneName}/rrsets`,
  );
  const conflicting = (existing.rrsets ?? []).filter((r) =>
    records.some((n) => fqdn(n.name) === r.name && n.type === r.type),
  );

  await authedFetch<unknown>(`${projectPath()}/managedZones/${zoneName}/changes`, {
    method: 'POST',
    body: JSON.stringify({
      additions: records.map((r) => ({ ...r, name: fqdn(r.name) })),
      deletions: conflicting,
    }),
  });
}

/** Fetch the authoritative name servers for a managed zone — needed so the
 *  registrar can be pointed at Cloud DNS after registration. */
export async function getNameServers(zoneName: string): Promise<string[]> {
  const zone = await authedFetch<CloudDnsManagedZone>(
    `${projectPath()}/managedZones/${zoneName}`,
  );
  return zone.nameServers ?? [];
}
