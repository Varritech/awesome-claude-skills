import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeenStore, newSince } from '../src/seen.js';

let dir, path;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'seen-')); path = join(dir, 'seen.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const FOLLOW = { handle: 'ana', source: 'follower', postId: null };
const LIKE = { handle: 'bob', source: 'liker', postId: 'P1' };

describe('notification snapshot + diff', () => {
  it('treats the very first look as a baseline: remembers everything, surfaces nothing', () => {
    const store = createSeenStore({ path });
    expect(store.isBaseline()).toBe(true);

    const fresh = newSince([FOLLOW, LIKE], store);

    expect(fresh).toEqual([]);              // nobody gets messaged on the first look
    expect(store.isBaseline()).toBe(false); // but we now know where we stood
  });

  it('surfaces only what appeared since the last look', () => {
    const store = createSeenStore({ path });
    newSince([FOLLOW], store);                       // baseline

    const reloaded = createSeenStore({ path });      // next poll, fresh process
    const fresh = newSince([FOLLOW, LIKE], reloaded);

    expect(fresh).toEqual([LIKE]);
  });
});
