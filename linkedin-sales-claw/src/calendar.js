// Booking a call on Cristiano's Google Calendar (christian@varritech.com).
//
// Cristiano 2026-10-16: book between "10 till 6 Eastern (New York) time,
// Monday to Friday", and send the invite to them and him. Slots are computed
// here from free/busy, never by the model, so it cannot offer a time he is
// already booked or outside working hours.

export const TZ = 'America/New_York';
export const WORK = { startHour: 10, endHour: 18, days: [1, 2, 3, 4, 5] };
export const CALL_MINUTES = 30;
const MIN = 60 * 1000;

const parts = (d) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(d).map((p) => [p.type, p.value]),
);

/** The UTC instant of a New York wall-clock time (DST-safe). */
function nyInstant(y, m, d, h, min) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = parts(new Date(guess));
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asIfUtc - guess));
}

export function slotLabel(date) {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
  return `${s.replace(/^(\w+), /, '$1 ')} ET`;
}

/** New York wall-clock "YYYY-MM-DDTHH:MM:00", the shape the calendar API takes with a timezone. */
export function nyLocal(date) {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00`;
}

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Free 30-minute slots on the half hour, inside working hours, at least
 * `minLeadHours` from now, over the next `days` calendar days.
 * -> [{ start: ISO UTC, label: 'Mon Oct 19, 10:00 AM ET' }]
 */
export function openSlots({ busy = [], now = new Date(), days = 7, minLeadHours = 3, minutes = CALL_MINUTES }) {
  const blocks = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)]);
  const earliest = +now + minLeadHours * 60 * MIN;
  const out = [];
  for (let i = 0; i <= days; i += 1) {
    const p = parts(new Date(+now + i * 24 * 60 * MIN));
    if (!WORK.days.includes(DOW[p.weekday])) continue;
    for (let h = WORK.startHour; h < WORK.endHour; h += 0.5) {
      const start = nyInstant(+p.year, +p.month, +p.day, Math.floor(h), (h % 1) * 60);
      const end = +start + minutes * MIN;
      if (+start < earliest) continue;
      if (end > +nyInstant(+p.year, +p.month, +p.day, WORK.endHour, 0)) continue;
      if (blocks.some(([bs, be]) => +start < be && end > bs)) continue;
      out.push({ start: start.toISOString(), label: slotLabel(start) });
    }
  }
  return out;
}

/**
 * `exec(slug, args)` runs one Composio tool and returns its `data`.
 * `notify` = Cristiano's address, added as a guest so the invite reaches him
 * too (the calendar owner, christian@, is the organizer).
 */
export function calendarClient({ exec, notify = null, minutes = CALL_MINUTES }) {
  async function busyBetween(from, to) {
    const data = await exec('GOOGLECALENDAR_FIND_FREE_SLOTS', {
      items: ['primary'], time_min: from.toISOString(), time_max: to.toISOString(), timezone: TZ,
    });
    return Object.values(data?.calendars ?? data?.response_data?.calendars ?? {}).flatMap((c) => c.busy ?? []);
  }

  async function freeSlots({ now = new Date(), days = 7, minLeadHours = 3 } = {}) {
    const busy = await busyBetween(now, new Date(+now + (days + 1) * 24 * 60 * MIN));
    return openSlots({ busy, now, days, minLeadHours, minutes });
  }

  /** Re-checks the slot right before writing, so two leads never land on one time. */
  async function book({ start, email, name, company = null, now = new Date() }) {
    const at = new Date(start);
    const end = new Date(+at + minutes * MIN);
    const busy = await busyBetween(at, end);
    const ok = openSlots({ busy, now, days: Math.ceil((+at - +now) / (24 * 60 * MIN)) + 1, minLeadHours: 0, minutes })
      .some((s) => s.start === at.toISOString());
    if (!ok) return { ok: false, reason: 'slot-not-free' };

    const who = company ? `${name} (${company})` : name;
    const data = await exec('GOOGLECALENDAR_CREATE_EVENT', {
      summary: `Varritech x ${who}: AI agents call`,
      description: [
        `A 30 minute call to map where ${name.split(' ')[0]}'s team spends its hours and pick the first process an AI agent takes over.`,
        '<ul><li>Where the hours go today</li><li>The process with the biggest payoff</li><li>How the free first build works</li></ul>',
      ].join('\n'),
      start_datetime: nyLocal(at), timezone: TZ,
      event_duration_hour: Math.floor(minutes / 60), event_duration_minutes: minutes % 60,
      attendees: [email, ...(notify ? [notify] : [])],
      send_updates: true, create_meeting_room: true,
    });
    const ev = data?.response_data ?? data ?? {};
    return { ok: true, eventId: ev.id ?? null, link: ev.htmlLink ?? null, label: slotLabel(at) };
  }

  return { freeSlots, book };
}

/** Composio v3 REST, entity claude_user (where the Google Calendar connection lives). */
export function composioExec({ apiKey, userId = 'claude_user', connectedAccountId, fetchImpl = fetch }) {
  return async (slug, args) => {
    const res = await fetchImpl(`https://backend.composio.dev/api/v3/tools/execute/${slug}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...(connectedAccountId ? { connected_account_id: connectedAccountId } : {}), arguments: args }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.successful === false) throw new Error(`composio ${slug} ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
    return json.data;
  };
}

/** What the model gets to offer: per day, the first morning slot and the first from 2 PM, earliest days first. */
export function spreadSlots(slots, max = 8) {
  const out = [];
  const seen = new Set();
  for (const s of slots) {
    const day = s.label.slice(0, s.label.indexOf(','));
    const pm = /\b[2-5]:\d\d PM\b/.test(s.label);
    const am = /\bAM\b|\b12:\d\d PM\b/.test(s.label);
    const key = `${day}:${pm ? 'pm' : am ? 'am' : 'x'}`;
    if (key.endsWith('x') || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
