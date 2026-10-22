import { describe, it, expect } from 'vitest';
import { dueForFollowUp, DEFAULT_CADENCE_DAYS } from '../src/followups.js';

const DAY = 86400_000;
const NOW = new Date('2026-08-20T15:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString();
const ledgerOf = (...entries) => ({ all: () => entries });

describe('dueForFollowUp', () => {
  it('leaves a fresh opener alone', () => {
    const led = ledgerOf({ handle: 'ana', at: ago(1), text: 'hi' });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
  });

  it('surfaces someone who has been silent past the first cadence step', () => {
    const led = ledgerOf({ handle: 'ana', at: ago(4), text: 'hi' });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toMatchObject([
      { handle: 'ana', followUpNumber: 1, opener: 'hi', silentDays: 4, source: null, reopen: false },
    ]);
  });

  it('never follows up someone who replied', () => {
    // The whole point of a follow-up is silence. A reply means the sales claw
    // owns the conversation now and us barging in would talk over it.
    const led = ledgerOf({ handle: 'ana', at: ago(30), text: 'hi', replied: true });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
  });

  it('DOES reopen someone we already had a thread with', () => {
    // ⛔ REVERSED 2026-09-10 (Cristiano: "it should follow up with literally
    // everyone who we've ever talked to on IG"). An existing-thread contact is
    // precisely someone he HAS talked to — 34 of them sat permanently frozen.
    // They come back marked `reopen` so the copy can differ: there is no opener
    // of ours to follow up on.
    const led = ledgerOf({ handle: 'ana', at: ago(30), status: 'skipped', reason: 'existing-thread' });
    const due = dueForFollowUp({ ledger: led, now: NOW });
    expect(due).toHaveLength(1);
    expect(due[0].reopen).toBe(true);
  });

  it('still refuses someone whose DMs are actually shut', () => {
    const led = ledgerOf({ handle: 'ana', at: ago(30), status: 'skipped', reason: 'dms-closed' });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
  });

  it('never follows up someone whose delivery is permanently blocked', () => {
    // "Can't receive your message... don't allow new message requests from
    // everyone" is a permanent wall, not a delay — re-knocking just reopens
    // a dead thread and burns a batch slot forever if this isn't excluded.
    const led = ledgerOf({
      handle: 'ana', at: ago(30), text: 'hi',
      blocked: true, blockedReason: 'message-request-blocked-not-delivered',
    });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
  });

  it('measures the second step from the LAST follow-up, not the original opener', () => {
    // Sent day 0, followed up day 3. The second step is 7 days after THAT,
    // so at day 8 overall it is not due yet — measuring from the opener would
    // have fired it early and stacked two messages nearly together.
    const led = ledgerOf({
      handle: 'ana', at: ago(8), text: 'hi',
      followUps: [{ at: ago(5), text: 'still around?' }],
    });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);

    const older = ledgerOf({
      handle: 'ana', at: ago(12), text: 'hi',
      followUps: [{ at: ago(9), text: 'still around?' }],
    });
    expect(dueForFollowUp({ ledger: older, now: NOW })).toMatchObject([
      { handle: 'ana', followUpNumber: 2, opener: 'hi', silentDays: 12, source: null, reopen: false },
    ]);
  });

  it('never stops for good — the last interval just repeats', () => {
    // ⛔ REVERSED 2026-09-10 (Cristiano: "follow up with literally everyone").
    // This used to retire a thread once the named cadence was spent, which had
    // frozen out 36 people permanently. Now the FINAL interval repeats, so they
    // keep getting knocked without ever being knocked faster than a fresh lead.
    const led = ledgerOf({
      handle: 'ana', at: ago(60), text: 'hi',
      followUps: [{ at: ago(50) }, { at: ago(40) }],
    });
    const due = dueForFollowUp({ ledger: led, now: NOW });
    expect(due).toHaveLength(1);
    expect(due[0].followUpNumber).toBe(3);
  });

  it('puts the longest-silent person first, so nobody rots at the back of the queue', () => {
    const led = ledgerOf(
      { handle: 'newer', at: ago(4), text: 'hi' },
      { handle: 'older', at: ago(9), text: 'hi' },
    );
    expect(dueForFollowUp({ ledger: led, now: NOW }).map((f) => f.handle)).toEqual(['older', 'newer']);
  });
});
