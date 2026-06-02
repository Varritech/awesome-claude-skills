/**
 * Helpers for computing the next "send window" timestamp for queued emails.
 */

/**
 * Returns the next 08:00:00.000 UTC strictly in the future as an ISO string.
 *
 * If called at exactly 08:00:00 UTC, returns the following day's 08:00 UTC.
 */
export function next8amUtc(now: Date = new Date()): string {
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0, 0),
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}
