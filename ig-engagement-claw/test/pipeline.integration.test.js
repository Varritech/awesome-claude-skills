import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { planBatch, commitSend } from '../src/pipeline.js';

let dir, path;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'claw-')); path = join(dir, 'contacted.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const WORKDAY = new Date('2026-08-13T14:00:00-04:00');
const SCRAPE = {
  readNewFollowers: [{ handle: '@Ana' }, { handle: 'bob' }],
  readRecentPosts: [{ postId: 'P1', caption: 'cutting render time' }],
  readPostLikers: [{ handle: 'carl' }],
};
const llm = async ({ target }) => `Hey ${target.handle}, saw you around. What are you building? https://varritech.com`;
const memStore = () => { const d = new Map(); return { d, get: async (c, k) => d.get(`${c}/${k}`) ?? null, set: async (c, k, v) => d.set(`${c}/${k}`, v) }; };

describe('plan -> send -> commit -> replan', () => {
  it('never re-offers a person once their send is committed', async () => {
    const store = memStore();

    const first = await planBatch({ scrape: SCRAPE, ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });
    expect(first.batch.map((t) => t.handle).sort()).toEqual(['ana', 'bob', 'carl']);
    // carl liked P1, so he is ranked first and his opener can reference the post
    expect(first.batch[0].handle).toBe('carl');
    // the link the model tacked on must not survive to the browser
    for (const t of first.batch) expect(t.text).not.toMatch(/varritech\.com|https?:/);

    // agent reports two of the three actually sent
    for (const h of ['carl', 'ana']) {
      const t = first.batch.find((x) => x.handle === h);
      await commitSend({ ledger: createLedger({ path }), store, handle: h, text: t.text, igUserId: h === 'carl' ? '55' : null, now: WORKDAY });
    }

    // next hour: fresh process, fresh ledger read off disk
    const second = await planBatch({ scrape: SCRAPE, ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });
    expect(second.batch.map((t) => t.handle)).toEqual(['bob']);

    // and the sales claw can see the opener it must not repeat
    expect(store.d.get('ig_threads/55').turns[0].role).toBe('us');
    expect(store.d.get('ig_pending_openers/ana')).toBeTruthy();
  });

  it('keys the handoff by the same normalized handle the ledger uses', async () => {
    const store = memStore();
    await commitSend({ ledger: createLedger({ path }), store, handle: '@Ana', text: 'hi', now: WORKDAY });

    expect(store.d.has('ig_pending_openers/ana')).toBe(true);
    expect(store.d.has('ig_pending_openers/@Ana')).toBe(false);
  });
});
