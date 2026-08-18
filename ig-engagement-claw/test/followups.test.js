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
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([
      { handle: 'ana', followUpNumber: 1, opener: 'hi', silentDays: 4 },
    ]);
  });

  it('never follows up someone who replied', () => {
    // The whole point of a follow-up is silence. A reply means the sales claw
    // owns the conversation now and us barging in would talk over it.
    const led = ledgerOf({ handle: 'ana', at: ago(30), text: 'hi', replied: true });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
  });

  it('never follows up someone we never actually messaged', () => {
    const led = ledgerOf({ handle: 'ana', at: ago(30), status: 'skipped', reason: 'existing-thread' });
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
    expect(dueForFollowUp({ ledger: older, now: NOW })).toEqual([
      { handle: 'ana', followUpNumber: 2, opener: 'hi', silentDays: 12 },
    ]);
  });

  it('stops for good after the cadence runs out, however long they stay silent', () => {
    const led = ledgerOf({
      handle: 'ana', at: ago(400), text: 'hi',
      followUps: [{ at: ago(397), text: 'a' }, { at: ago(390), text: 'b' }],
    });
    expect(dueForFollowUp({ ledger: led, now: NOW })).toEqual([]);
    expect(DEFAULT_CADENCE_DAYS).toHaveLength(2);
  });

  it('puts the longest-silent person first, so nobody rots at the back of the queue', () => {
    const led = ledgerOf(
      { handle: 'newer', at: ago(4), text: 'hi' },
      { handle: 'older', at: ago(9), text: 'hi' },
    );
    expect(dueForFollowUp({ ledger: led, now: NOW }).map((f) => f.handle)).toEqual(['older', 'newer']);
  });
});
