// Batch selection — decides who, out of everything we scraped, actually gets a
// DM in THIS run. Everything ban-shaped lives here: the never-again rule, the
// hourly cap, and the business-hours window.

// A commenter typed words at us, so the opener can quote them back. A liker
// engaged with a specific post, so it can at least reference the post. A bare
// follower gives us nothing to open on. When slots are scarce, spend them where
// the message can actually be specific.
import { normalizeHandle } from './handle.js';

const PRIORITY = { commenter: 0, liker: 1, follower: 2 };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Hour + weekday as they read in Cristiano's timezone, not the server's.
function localClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    // ⛔ hourCycle h23, NOT hour12:false — the latter reports midnight as "24",
    // so any window starting at 0 silently excluded the whole midnight hour.
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { hour: Number(get('hour')), weekday: get('weekday') };
}

// A cold DM at 3am is a bot tell to Instagram and a bad look to the human.
export function isSendingWindow(now, { timeZone = 'America/New_York', startHour = 9, endHour = 20 } = {}) {
  const { hour, weekday } = localClock(now, timeZone);
  if (!WEEKDAYS.includes(weekday)) return false;
  return hour >= startHour && hour < endHour;
}

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How many sends are still allowed right now.
 *
 * ⛔ Measured in WALL-CLOCK time off the ledger, never per run. The claw polls
 * every few minutes so it can catch a follow while the person still remembers
 * us — if the cap were per-run, that polling frequency would silently multiply
 * the daily send volume by however often cron happens to fire.
 */
export function remainingBudget({ ledger, rate, cap }) {
  if (!rate) return cap;
  const perHourLeft = rate.perHour == null ? Infinity : rate.perHour - ledger.sentSince(HOUR_MS);
  const perDayLeft = rate.perDay == null ? Infinity : rate.perDay - ledger.sentSince(DAY_MS);
  return Math.max(0, Math.min(cap, perHourLeft, perDayLeft));
}

export function selectBatch({ targets, ledger, cap, now, window: win, rate, exclude = [] }) {
  if (!isSendingWindow(now, win)) return [];
  const budget = remainingBudget({ ledger, rate, cap });
  if (budget <= 0) return [];
  // Own accounts, family, clients — anyone who must never receive a cold opener.
  // Cristiano's personal @varriale.cristiano likes the company posts, so without
  // this the claw would cold-pitch him from his own brand account.
  const blocked = new Set(exclude.map(normalizeHandle));
  const fresh = targets.filter((t) => !blocked.has(normalizeHandle(t.handle)) && !ledger.has(t.handle));
  fresh.sort((a, b) => (PRIORITY[a.source] ?? 9) - (PRIORITY[b.source] ?? 9));
  return fresh.slice(0, budget);
}
