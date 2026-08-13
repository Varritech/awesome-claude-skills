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
});
