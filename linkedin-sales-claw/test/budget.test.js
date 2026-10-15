import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { connectBudget } from '../src/budget.js';

const freshLedger = () => createLedger({ path: join(mkdtempSync(join(tmpdir(), 'li-')), 'l.json') });
const DAY = 86400_000;

describe('connectBudget', () => {
  it('allows 5 a day in the first week, counting invites already sent today', () => {
    const ledger = freshLedger();
    const now = new Date('2026-10-15T15:00:00Z');
    expect(connectBudget({ ledger, now })).toBe(5);
    ledger.recordInvite('ana-smith', { at: new Date(now - 3600_000).toISOString() });
    ledger.recordInvite('bo-li', { at: new Date(now - 7200_000).toISOString() });
    expect(connectBudget({ ledger, now })).toBe(3);
  });

  it('ramps 10, 18, then 20 a day as the account ages from its first invite', () => {
    const ledger = freshLedger();
    const first = new Date('2026-10-01T12:00:00Z');
    ledger.recordInvite('first-one', { at: first.toISOString() });
    expect(connectBudget({ ledger, now: new Date(+first + 8 * DAY) })).toBe(10);
    expect(connectBudget({ ledger, now: new Date(+first + 15 * DAY) })).toBe(18);
    expect(connectBudget({ ledger, now: new Date(+first + 40 * DAY) })).toBe(20);
  });

  it('never invites the same person twice', () => {
    const ledger = freshLedger();
    ledger.recordInvite('ana-smith', { at: new Date().toISOString() });
    expect(() => ledger.recordInvite('ana-smith', { at: new Date().toISOString() })).toThrow();
  });
});

describe('sentSince', () => {
  it('does not count copied thread history as messages we sent', () => {
    const ledger = freshLedger();
    ledger.recordExisting('x', { at: new Date().toISOString(), name: 'X', recipient: 'R' });
    ledger.recordMessage('x', { at: new Date().toISOString(), from: 'us', text: 'old', kind: 'history' });
    ledger.recordMessage('x', { at: new Date().toISOString(), from: 'us', text: 'new', kind: 'reply' });
    expect(ledger.sentSince(3600_000)).toBe(1);
  });
});
