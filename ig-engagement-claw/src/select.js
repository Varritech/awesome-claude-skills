// Batch selection — decides who, out of everything we scraped, actually gets a
// DM in THIS run. Everything ban-shaped lives here: the never-again rule, the
// hourly cap, and the business-hours window.

// A liker engaged with a specific post, so the opener can reference something
// real. A bare follower gives us nothing to open on. When slots are scarce,
// spend them where the message can actually be specific.
const PRIORITY = { liker: 0, follower: 1 };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Hour + weekday as they read in Cristiano's timezone, not the server's.
function localClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
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

export function selectBatch({ targets, ledger, cap, now, window: win }) {
  if (!isSendingWindow(now, win)) return [];
  const fresh = targets.filter((t) => !ledger.has(t.handle));
  fresh.sort((a, b) => (PRIORITY[a.source] ?? 9) - (PRIORITY[b.source] ?? 9));
  return fresh.slice(0, cap);
}
