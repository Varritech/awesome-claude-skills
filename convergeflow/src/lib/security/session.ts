/**
 * Session timeout constants and timer helpers.
 */

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_WARNING_MS = SESSION_TIMEOUT_MS - 2 * 60 * 1000; // Show warning 2 min before

/**
 * Returns true if the last activity timestamp is older than the timeout.
 */
export function isSessionExpired(lastActivityAt: number, nowMs = Date.now()): boolean {
  return nowMs - lastActivityAt >= SESSION_TIMEOUT_MS;
}

/**
 * Returns true if we're within the 2-minute warning window before expiry.
 */
export function isSessionExpiringSoon(lastActivityAt: number, nowMs = Date.now()): boolean {
  const elapsed = nowMs - lastActivityAt;
  return elapsed >= SESSION_WARNING_MS && elapsed < SESSION_TIMEOUT_MS;
}

/**
 * Returns milliseconds until session expires from lastActivityAt.
 * Returns 0 if already expired.
 */
export function msUntilExpiry(lastActivityAt: number, nowMs = Date.now()): number {
  const remaining = SESSION_TIMEOUT_MS - (nowMs - lastActivityAt);
  return Math.max(0, remaining);
}
