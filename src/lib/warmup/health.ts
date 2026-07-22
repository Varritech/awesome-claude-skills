/**
 * Pure helpers for the inbox health view. Extracted from the route so the
 * 14-day warmup window + status badge mapping are unit-testable and the route
 * file only exports its handler (per Next.js route convention).
 */

export type StatusBadge = "healthy" | "warming" | "warning" | "error";

/** Warmup window in days — must match the scheduler ramp that caps at day 14. */
export const WARMUP_WINDOW_DAYS = 14;

/**
 * Warmup progress as a percentage of the 14-day window (0–100).
 * `now` is injectable for deterministic tests.
 */
export function warmupProgressPercent(
  warmupStartDate: string | null | undefined,
  now: Date = new Date(),
  targetDays: number = WARMUP_WINDOW_DAYS,
): number {
  if (!warmupStartDate) return 0;
  const start = new Date(warmupStartDate);
  if (isNaN(start.getTime())) return 0;
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (elapsedDays < 0) return 0;
  return Math.min(100, Math.round((elapsedDays / targetDays) * 100));
}

export function statusBadge(status: string, bounceRate: number): StatusBadge {
  if (status === "error" || status === "disconnected") return "error";
  if (bounceRate > 0.1) return "warning";
  if (status === "warming") return "warming";
  return "healthy";
}