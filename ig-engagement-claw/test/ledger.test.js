import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ledger-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('contacted ledger', () => {
  it('remembers a contacted handle across a fresh load', () => {
    const path = join(dir, 'contacted.json');
    const first = createLedger({ path });
    expect(first.has('@someone')).toBe(false);

    first.record('@someone', { source: 'follower', at: '2026-08-13T10:00:00.000Z' });

    const reloaded = createLedger({ path });
    expect(reloaded.has('@someone')).toBe(true);
  });

  it('treats @Handle and handle as the same person', () => {
    const led = createLedger({ path: join(dir, 'contacted.json') });
    led.record('@CristianoV', { source: 'liker' });
    expect(led.has('cristianov')).toBe(true);
    expect(led.has('  @CRISTIANOV ')).toBe(true);
    expect(led.size()).toBe(1);
  });

  it('counts only sends inside the window, so a rolling budget can be enforced', () => {
    const led = createLedger({ path: join(dir, 'contacted.json') });
    const now = Date.parse('2026-08-13T15:00:00.000Z');
    led.record('recent1', { at: '2026-08-13T14:30:00.000Z' });   // 30 min ago
    led.record('recent2', { at: '2026-08-13T14:59:00.000Z' });   // 1 min ago
    led.record('old', { at: '2026-08-13T10:00:00.000Z' });       // 5 hours ago

    expect(led.sentSince(3600_000, now)).toBe(2);
    expect(led.sentSince(24 * 3600_000, now)).toBe(3);
  });
});

describe('follow-ups and replies', () => {
  const p = () => join(dir, 'contacted.json');
  it('appends a follow-up without destroying the original opener', () => {
    const led = createLedger({ path: p() });
    led.record('ana', { at: '2026-08-17T00:00:00.000Z', text: 'the opener' });
    led.recordFollowUp('ana', { at: '2026-08-20T00:00:00.000Z', text: 'second knock' });

    const e = createLedger({ path: p() }).all().find((x) => x.handle === 'ana');
    expect(e.text).toBe('the opener');
    expect(e.followUps).toEqual([{ at: '2026-08-20T00:00:00.000Z', text: 'second knock' }]);
  });

  it('counts a follow-up against the send budget, because it is a real DM', () => {
    const led = createLedger({ path: p() });
    led.record('ana', { at: '2026-08-01T00:00:00.000Z', text: 'old opener' });
    led.recordFollowUp('ana', { at: '2026-08-17T12:00:00.000Z', text: 'knock' });

    // The opener is ancient; only the follow-up falls inside the window. If
    // follow-ups did not count, a backlog of them could blow straight past
    // MAX_PER_HOUR in a single run.
    const now = Date.parse('2026-08-17T12:30:00.000Z');
    expect(led.sentSince(3600_000, now)).toBe(1);
  });

  it('marks a reply so the follow-up chain stops', () => {
    const led = createLedger({ path: p() });
    led.record('ana', { at: '2026-08-17T00:00:00.000Z', text: 'the opener' });
    led.markReplied('ana');
    expect(createLedger({ path: p() }).all().find((x) => x.handle === 'ana').replied).toBe(true);
  });

  it('refuses to follow up someone with no opener on record', () => {
    const led = createLedger({ path: p() });
    expect(() => led.recordFollowUp('ghost', { at: '2026-08-20T00:00:00.000Z', text: 'x' })).toThrow(/ghost/);
  });
});

