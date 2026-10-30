/*
 * Anyone who follows @varriale.cristiano is a personal friend of Cristiano's
 * and must never get a DM from this claw (Cristiano, 2026-10-30).
 *
 * The browser agent fetches the lookup; Node reads it and decides.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { friendVerdict, applyFriendCheck } from '../src/friends.js';
import { createLedger } from '../src/ledger.js';
import { dueForFollowUp } from '../src/followups.js';

const ok = (...users) => ({ status: 'ok', users: users.map((username) => ({ username })) });
const tmpLedger = () => createLedger({ path: join(mkdtempSync(join(tmpdir(), 'friends-')), 'c.json') });

describe('friendVerdict', () => {
  it('calls an exact match in the followers lookup a friend', () => {
    expect(friendVerdict(ok('fullmetalpizza'), 'fullmetalpizza')).toBe('friend');
  });

  it('ignores case and a leading @ on the handle', () => {
    expect(friendVerdict(ok('FullMetalPizza'), '@fullmetalpizza')).toBe('friend');
  });

  it('is clear when the lookup comes back empty', () => {
    expect(friendVerdict(ok(), 'nasa')).toBe('clear');
  });

  it('does not treat a similar handle as the same person', () => {
    // The query is a substring search: "ana" also returns "ana.fit".
    expect(friendVerdict(ok('ana.fit', 'banana'), 'ana')).toBe('clear');
  });

  it.each([
    ['a null response', null],
    ['a rate-limit body', { status: 'fail', message: 'Please wait a few minutes' }],
    ['ok with no users list', { status: 'ok' }],
    ['an error marker from the browser', { error: 'TypeError: Failed to fetch' }],
  ])('never reports clear on %s', (_, response) => {
    expect(friendVerdict(response, 'ana')).toBe('unknown');
  });
});

describe('applyFriendCheck', () => {
  it('records a new friend so they are never planned again, without using send budget', () => {
    const ledger = tmpLedger();
    expect(applyFriendCheck({ ledger, handle: 'pal', response: ok('pal') })).toBe('friend');
    expect(ledger.has('pal')).toBe(true);
    expect(ledger.sentSince(3600_000)).toBe(0);
  });

  it('never reopens a new friend as a follow-up later on', () => {
    // dueForFollowUp reopens plain skipped rows, so a bare skip would still DM them.
    const ledger = tmpLedger();
    applyFriendCheck({ ledger, handle: 'pal', response: ok('pal'), now: new Date(Date.now() - 30 * 86400_000) });
    expect(dueForFollowUp({ ledger, now: new Date(), cadenceDays: [3, 7] }).map((t) => t.handle)).not.toContain('pal');
  });

  it('stops follow-ups to a friend we already messaged', () => {
    const ledger = tmpLedger();
    const longAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
    ledger.record('pal', { at: longAgo, text: 'hi', source: 'follower' });
    const due = () => dueForFollowUp({ ledger, now: new Date(), cadenceDays: [3, 7] }).map((t) => t.handle);
    expect(due()).toContain('pal');
    applyFriendCheck({ ledger, handle: 'pal', response: ok('pal') });
    expect(due()).not.toContain('pal');
  });

  it('records nothing on clear or unknown, so the person stays eligible', () => {
    const ledger = tmpLedger();
    expect(applyFriendCheck({ ledger, handle: 'a', response: ok() })).toBe('clear');
    expect(applyFriendCheck({ ledger, handle: 'b', response: null })).toBe('unknown');
    expect(ledger.has('a')).toBe(false);
    expect(ledger.has('b')).toBe(false);
  });
});
