/**
 * Warmup scheduler — computes how many emails an inbox can send today
 * based on how many days it has been warming up.
 *
 * Schedule (conservative, Mailforge-recommended):
 *   Day 1:  5 emails
 *   Day 2:  8 emails
 *   ...
 *   +3/day until dailySendLimit is reached, then holds at limit.
 *
 * Sends are spread across a random window within business hours
 * (8am–6pm in the inbox's timezone) to mimic human behavior.
 */

export interface WarmupState {
  warmupEnabled: boolean;
  warmupStartDate: string | null; // ISO datetime
  dailySendLimit: number;         // ultimate cap (e.g. 50)
  status: string;
}

const WARMUP_BASE = 5;     // day-1 quota
const WARMUP_STEP = 3;     // +3 per day

/**
 * Returns the send quota for today given the warmup state.
 * Returns 0 if warmup hasn't started or inbox isn't active.
 */
export function todayQuota(state: WarmupState): number {
  if (!state.warmupEnabled || !state.warmupStartDate) return 0;
  if (!['warming', 'active'].includes(state.status)) return 0;

  const start = new Date(state.warmupStartDate);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86_400_000);

  if (daysSinceStart < 0) return 0;

  const quota = WARMUP_BASE + daysSinceStart * WARMUP_STEP;
  return Math.min(quota, state.dailySendLimit);
}

/**
 * Returns true if the inbox has completed warmup
 * (quota has reached dailySendLimit).
 */
export function isWarmedUp(state: WarmupState): boolean {
  return todayQuota(state) >= state.dailySendLimit;
}

/**
 * Returns a random delay in ms to spread sends across business hours.
 * windowHours: how many hours in the sending window (default 8h).
 */
export function randomSendDelay(windowHours = 8): number {
  return Math.floor(Math.random() * windowHours * 3_600_000);
}

/**
 * Formats warmup progress as a percentage (0-100).
 */
export function warmupProgress(state: WarmupState): number {
  const quota = todayQuota(state);
  return Math.round((quota / state.dailySendLimit) * 100);
}
