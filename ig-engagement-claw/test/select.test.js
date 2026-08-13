import { describe, it, expect } from 'vitest';
import { selectBatch } from '../src/select.js';

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

  it('caps the batch and spends the slots on likers before followers', () => {
    const batch = selectBatch({
      targets: [
        { handle: 'ana', source: 'follower' },
        { handle: 'bob', source: 'liker', postId: 'P1' },
        { handle: 'carl', source: 'follower' },
        { handle: 'dee', source: 'liker', postId: 'P1' },
      ],
      ledger: ledgerOf(),
      cap: 2,
      now: WORKDAY,
    });
    expect(batch).toHaveLength(2);
    expect(batch.map((t) => t.handle).sort()).toEqual(['bob', 'dee']);
  });

  it('sends nothing outside business hours', () => {
    const batch = selectBatch({
      targets: targets('ana', 'bob'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-13T03:00:00-04:00'), // 3am
    });
    expect(batch).toEqual([]);
  });

  it('sends nothing on a Sunday', () => {
    const batch = selectBatch({
      targets: targets('ana'),
      ledger: ledgerOf(),
      cap: 10,
      now: new Date('2026-08-16T14:00:00-04:00'), // Sunday 2pm
    });
    expect(batch).toEqual([]);
  });
});
