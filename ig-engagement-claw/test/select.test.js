import { describe, it, expect } from 'vitest';
import { selectBatch, isSendingWindow } from '../src/select.js';

const targets = (...handles) => handles.map((h) => ({ handle: h, source: 'follower' }));
const ledgerOf = (...contacted) => ({ has: (h) => contacted.includes(h) });
// 2pm on a Thursday, inside business hours.
const WORKDAY = new Date('2026-08-13T14:00:00-04:00');

describe('selectBatch', () => {
  it('never returns someone already in the ledger', () => {
    const batch = selectBatch({
      targets: targets('ana', 'bob', 'carl'),
      ledger: ledgerOf('bob'),
      cap: 10,
      now: WORKDAY,
    });
    expect(batch.map((t) => t.handle)).toEqual(['ana', 'carl']);
  });

  it('returns each person once even when the feed lists them twice', () => {
    // Live 2026-10-10: the extracted notification rows came in pairs, so next
    // planned the same person twice with two different openers. Only the
    // runner's own caution stopped a double DM.
    const batch = selectBatch({
      targets: [
        { handle: 'kidtuf84', source: 'commenter' },
        { handle: 'kidtuf84', source: 'commenter' },
        { handle: 'ana', source: 'follower' },
      ],
      ledger: ledgerOf(),
      cap: 10,
      now: WORKDAY,
    });
    expect(batch.map((t) => t.handle).sort()).toEqual(['ana', 'kidtuf84']);
  });

  it('spends scarce slots on new followers first, then likers, then commenters', () => {
    // Cristiano 2026-10-10: "the ones who followed us recently", from the
    // notifications feed. Reversed the old commenter > liker > follower order,
    // which spent every slot on commenters and never reached a follower.
    const batch = selectBatch({
      targets: [
        { handle: 'carl', source: 'commenter', postId: 'P1', commentText: 'Build' },
        { handle: 'bob', source: 'liker', postId: 'P1' },
        { handle: 'ana', source: 'follower' },
        { handle: 'dee', source: 'follower' },
      ],
      ledger: ledgerOf(),
      cap: 3,
      now: WORKDAY,
    });
    expect(batch.map((t) => t.handle)).toEqual(['ana', 'dee', 'bob']);
  });

  it('keeps the feed order inside a source, so the newest follower goes first', () => {
    const batch = selectBatch({
      targets: [
        { handle: 'newest', source: 'follower' },
        { handle: 'older', source: 'follower' },
      ],
      ledger: ledgerOf(),
      cap: 1,
      now: WORKDAY,
    });
    expect(batch.map((t) => t.handle)).toEqual(['newest']);
  });

  it('sends at 3am, because there is no send window any more', () => {
    // Cristiano, 2026-09-09: "there is no send window." The claw polls every 5
    // minutes to catch someone right after they engage; a business-hours gate
    // threw away every overnight follow. This used to assert the opposite.
    const batch = selectBatch({
      targets: targets('ana', 'bob'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-13T03:00:00-04:00'), // 3am
    });
    expect(batch.map((t) => t.handle)).toEqual(['ana', 'bob']);
  });

  it('still honours a window when one is explicitly configured', () => {
    const batch = selectBatch({
      targets: targets('ana', 'bob'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-13T03:00:00-04:00'),
      window: { timeZone: 'America/New_York', startHour: 9, endHour: 20 },
    });
    expect(batch).toEqual([]);
  });

  it('sends on a Sunday inside business hours', () => {
    // Cristiano, 2026-09-06: "it needs to be everyday". The claw used to sit out
    // Sat/Sun entirely — two eligible new followers arrived on a Sunday and were
    // refused by the weekday gate, not by budget. Weekends now send.
    const batch = selectBatch({
      targets: targets('ana'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-16T14:00:00-04:00'), // Sunday 2pm
    });
    expect(batch.map((t) => t.handle)).toEqual(['ana']);
  });

  it('still respects an explicit days restriction when one is configured', () => {
    // The 7-day default is a default, not a removal — SEND_DAYS can still pin it
    // back to a subset without another code change.
    const batch = selectBatch({
      targets: targets('ana'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-16T14:00:00-04:00'), // Sunday 2pm
      window: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    });
    expect(batch).toEqual([]);
  });

  it('sends nothing when the rolling hourly budget is already spent', () => {
    // Polling every 5 min must not multiply sends by 12. The budget is measured
    // in wall-clock time from the ledger, not per run.
    const batch = selectBatch({
      targets: targets('ana', 'bob'),
      ledger: { has: () => false, sentSince: () => 4 },   // 4 already sent this hour
      cap: 3,
      now: WORKDAY,
      rate: { perHour: 4, perDay: 15 },
    });
    expect(batch).toEqual([]);
  });

  it('spends only the budget that is left, not the full per-run cap', () => {
    const batch = selectBatch({
      targets: targets('ana', 'bob', 'carl'),
      ledger: { has: () => false, sentSince: (ms) => (ms === 3600_000 ? 3 : 3) },
      cap: 3,
      now: WORKDAY,
      rate: { perHour: 4, perDay: 15 },   // 1 slot left this hour
    });
    expect(batch).toHaveLength(1);
  });

  it('reads midnight as hour 0, not 24', () => {
    // Intl with hour12:false returns "24" at midnight, so a 0-start window
    // silently excluded the whole midnight hour.
    expect(
      isSendingWindow(new Date('2026-08-14T00:30:00-04:00'), { startHour: 0, endHour: 6 })
    ).toBe(true);
  });

  it('never messages an excluded account (own/personal/family handles)', () => {
    const batch = selectBatch({
      targets: targets('varriale.cristiano', 'jess_varriale', 'astranger'),
      ledger: { has: () => false, sentSince: () => 0 },
      cap: 10,
      now: WORKDAY,
      exclude: ['varriale.cristiano', 'JESS_VARRIALE'],   // case-insensitive
    });
    expect(batch.map((t) => t.handle)).toEqual(['astranger']);
  });
});
