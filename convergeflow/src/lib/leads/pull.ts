/**
 * Pull fingerprint — a stable hash of a lead-search query.
 *
 * Stored on a `lead_pulls` doc so we can answer "have we already pulled this
 * exact query?" without re-calling the provider API. Same inputs → same
 * fingerprint, regardless of titles ordering or input casing.
 */
import { createHash } from 'node:crypto';

export interface PullFingerprintInput {
  provider: string;
  industry: string;
  location: string;
  titles?: string[];
}

export function pullFingerprint(input: PullFingerprintInput): string {
  const titles = [...(input.titles ?? [])].map((t) => t.trim().toLowerCase()).filter(Boolean).sort();
  const key = [
    input.provider.trim().toLowerCase(),
    input.industry.trim().toLowerCase(),
    input.location.trim().toLowerCase(),
    titles.join(','),
  ].join('|');
  return createHash('sha1').update(key).digest('hex');
}