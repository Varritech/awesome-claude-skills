import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { planBatch, commitSend, skipTarget } from '../src/pipeline.js';

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

  it('never re-offers someone skipped for already having a thread, and does not spend budget on them', async () => {
    // The agent opens the DM, sees prior messages, and backs out. That person
    // has "already been messaged" even though this claw never sent to them.
    await skipTarget({
      ledger: createLedger({ path }),
      handle: '@Ana',
      reason: 'existing-thread',
      now: WORKDAY,
    });

    const led = createLedger({ path });
    expect(led.has('ana')).toBe(true);
    expect(led.sentSince(3600_000, WORKDAY.getTime())).toBe(0);  // costs no send budget

    const plan = await planBatch({ scrape: SCRAPE, ledger: led, llm, cap: 10, now: WORKDAY });
    expect(plan.batch.map((t) => t.handle)).not.toContain('ana');
  });

  it('drops anyone whose opener came back unusable rather than sending an empty DM', async () => {
    const placeholderLlm = async ({ target }) =>
      target.handle === 'bob' ? 'Hey, into [their niche]?' : 'Hey, what are you building?';

    const plan = await planBatch({
      scrape: SCRAPE, ledger: createLedger({ path }), llm: placeholderLlm, cap: 10, now: WORKDAY,
    });

    expect(plan.batch.map((t) => t.handle)).not.toContain('bob');
    for (const t of plan.batch) expect(t.text.length).toBeGreaterThan(0);
  });
});
