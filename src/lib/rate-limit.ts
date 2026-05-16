/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-process dev/test. For production, swap the store for
 * a Firestore- or Redis-backed implementation.
 *
 * Usage:
 *   const result = checkRateLimit('user_123', 'search', 10, 60_000);
 *   if (!result.allowed) return 429 with Retry-After header
 */

interface WindowEntry {
  timestamps: number[];
}

// Module-level in-memory store — keyed by `${userId}:${action}`
const store = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests remain in the current window */
  remaining: number;
  /** Seconds until the oldest request leaves the window (used for Retry-After) */
  retryAfterSeconds: number;
}

/**
 * Check whether a request from `userId` for `action` is within the rate limit.
 *
 * @param userId   Clerk user ID (or any opaque identifier)
 * @param action   A string that namespaces the counter (e.g. 'leads:search')
 * @param limit    Maximum number of requests allowed within `windowMs`
 * @param windowMs Sliding window length in milliseconds
 */
export function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const entry = store.get(key) ?? { timestamps: [] };

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const remaining = Math.max(0, limit - entry.timestamps.length - 1);

  if (entry.timestamps.length >= limit) {
    // Calculate when the oldest in-window timestamp expires
    const oldest = entry.timestamps[0]!;
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    store.set(key, entry);

    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return { allowed: true, remaining, retryAfterSeconds: 0 };
}

/**
 * Reset the counter for a given userId + action.
 * Useful in tests to avoid state bleeding between cases.
 */
export function resetRateLimit(userId: string, action: string): void {
  store.delete(`${userId}:${action}`);
}

/**
 * Clear all rate limit counters. Useful in tests.
 */
export function clearAllRateLimits(): void {
  store.clear();
}
