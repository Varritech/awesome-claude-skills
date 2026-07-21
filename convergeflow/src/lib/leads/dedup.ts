/**
 * Deterministic de-duplication keys for leads.
 *
 * Re-pulling the same lead from a provider must upsert the existing doc
 * instead of creating a duplicate. We derive a stable Firestore doc id from
 * the provider + external id (fallback: normalized email hash) so the same
 * lead always maps to the same doc.
 */
import { createHash } from 'node:crypto';

export interface DedupInput {
  provider: string;
  externalId?: string;
  email?: string;
}

/** Strip characters that are unsafe in a Firestore doc id (notably "/"). */
function sanitizeIdSegment(s: string): string {
  return s.replace(/[/\\]/g, '');
}

/** Lowercase + trim an email for stable hashing. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns a deterministic Firestore doc id for a lead.
 * Prefers `ld_{provider}_{externalId}`; falls back to `ld_email_{sha1(email)}`
 * when no external id is available.
 */
export function dedupId({ provider, externalId, email }: DedupInput): string {
  if (externalId) {
    return `ld_${sanitizeIdSegment(provider)}_${sanitizeIdSegment(externalId)}`;
  }
  if (email) {
    const hash = createHash('sha1').update(normalizeEmail(email)).digest('hex');
    return `ld_email_${hash}`;
  }
  throw new Error('dedupId requires either externalId or email');
}