import { describe, it, expect } from 'vitest';
import { openSlots } from '../src/calendar.js';

// Fri 2026-10-16 15:00 ET (19:00Z). EDT = UTC-4 until Nov 1.
const now = new Date('2026-10-16T19:00:00Z');

describe('openSlots', () => {
  it('offers only Mon-Fri 10:00-18:00 New York time, after a lead time, skipping busy blocks', () => {
    const busy = [{ start: '2026-10-19T12:00:00-04:00', end: '2026-10-19T13:00:00-04:00' }];
    const slots = openSlots({ busy, now, days: 4, minLeadHours: 3 });
    const mondays = slots.filter((s) => s.start.startsWith('2026-10-19'));
    // Friday from 18:00 (now + 3h) has no 30-min slot left before 18:00; the weekend has none.
    expect(slots[0].start).toBe('2026-10-19T14:00:00.000Z');
    expect(slots.some((s) => /2026-10-1[78]/.test(s.start))).toBe(false);
    // Monday 10:00-17:30 ET starts on the half hour = 16 slots, minus 12:00 and 12:30.
    expect(mondays).toHaveLength(14);
    expect(mondays.map((s) => s.start)).not.toContain('2026-10-19T16:00:00.000Z');
    expect(mondays.at(-1).start).toBe('2026-10-19T21:30:00.000Z');
    expect(mondays[0].label).toBe('Mon Oct 19, 10:00 AM ET');
  });

  it('follows the clock change: 10:00 ET is 15:00Z after Nov 1', () => {
    const slots = openSlots({ busy: [], now: new Date('2026-10-30T22:00:00Z'), days: 5, minLeadHours: 3 });
    expect(slots[0].start).toBe('2026-11-02T15:00:00.000Z');
  });
});

import { calendarClient } from '../src/calendar.js';

const fakeExec = (busy = []) => {
  const calls = [];
  const exec = async (slug, args) => {
    calls.push({ slug, args });
    if (slug === 'GOOGLECALENDAR_FIND_FREE_SLOTS') return { calendars: { primary: { busy } } };
    if (slug === 'GOOGLECALENDAR_CREATE_EVENT') return { response_data: { id: 'evt1', htmlLink: 'https://cal/evt1' } };
    throw new Error(`unexpected ${slug}`);
  };
  return { exec, calls };
};

describe('calendarClient', () => {
  it('lists open slots from free/busy', async () => {
    const { exec } = fakeExec([{ start: '2026-10-19T10:00:00-04:00', end: '2026-10-19T17:00:00-04:00' }]);
    const slots = await calendarClient({ exec }).freeSlots({ now, days: 4 });
    expect(slots.map((s) => s.label)).toEqual(['Mon Oct 19, 5:00 PM ET', 'Mon Oct 19, 5:30 PM ET', ...slots.slice(2).map((s) => s.label)]);
    expect(slots[2].label).toMatch(/^Tue Oct 20, 10:00 AM ET$/);
  });

  it('books the slot on New York time, invites the lead and Cristiano, sends updates', async () => {
    const { exec, calls } = fakeExec();
    const r = await calendarClient({ exec, notify: 'cristiano@varritech.com' })
      .book({ start: '2026-10-19T14:00:00.000Z', email: 'dana@whitfieldhvac.com', name: 'Dana Whitfield', now });
    expect(r).toMatchObject({ ok: true, eventId: 'evt1' });
    const create = calls.find((c) => c.slug === 'GOOGLECALENDAR_CREATE_EVENT').args;
    expect(create).toMatchObject({
      start_datetime: '2026-10-19T10:00:00', timezone: 'America/New_York',
      event_duration_hour: 0, event_duration_minutes: 30, send_updates: true, create_meeting_room: true,
      attendees: ['dana@whitfieldhvac.com', 'cristiano@varritech.com'],
    });
    expect(create.summary).toContain('Dana Whitfield');
    expect(create.description).not.toMatch(/^Hi\b/);
  });

  it('refuses a slot that got booked since it was offered, or is outside working hours', async () => {
    const taken = fakeExec([{ start: '2026-10-19T10:00:00-04:00', end: '2026-10-19T11:00:00-04:00' }]);
    const r1 = await calendarClient({ exec: taken.exec }).book({ start: '2026-10-19T14:00:00.000Z', email: 'a@b.co', name: 'A', now });
    expect(r1).toEqual({ ok: false, reason: 'slot-not-free' });
    expect(taken.calls.some((c) => c.slug === 'GOOGLECALENDAR_CREATE_EVENT')).toBe(false);

    const free = fakeExec();
    const r2 = await calendarClient({ exec: free.exec }).book({ start: '2026-10-19T23:00:00.000Z', email: 'a@b.co', name: 'A', now });
    expect(r2).toEqual({ ok: false, reason: 'slot-not-free' });
  });
});

import { spreadSlots } from '../src/calendar.js';

describe('spreadSlots', () => {
  it('keeps the earliest morning and afternoon slot per day, up to 8', () => {
    const all = openSlots({ busy: [], now, days: 10, minLeadHours: 3 });
    const picked = spreadSlots(all);
    expect(picked).toHaveLength(8);
    expect(picked.slice(0, 2).map((s) => s.label)).toEqual(['Mon Oct 19, 10:00 AM ET', 'Mon Oct 19, 2:00 PM ET']);
    expect(new Set(picked.map((s) => s.label.slice(0, 10))).size).toBe(4);
  });
});
