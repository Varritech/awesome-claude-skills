import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { createSeenStore } from '../src/seen.js';
import { planBatch, commitSend, skipTarget } from '../src/pipeline.js';

let dir, path;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'claw-')); path = join(dir, 'contacted.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const WORKDAY = new Date('2026-08-13T14:00:00-04:00');
// Verbatim shapes from the live @varritech notifications feed.
const NOTIFS = [
  { handle: '@Ana', text: 'Ana started following you. 5m Follow Back', postHref: null },
  { handle: 'bob', text: 'bob started following you. 12m Follow Back', postHref: null },
  { handle: 'carl', text: 'carl liked your reel. 20m', postHref: '/p/P1/' },
];
const seenStore = () => createSeenStore({ path: join(dir, 'seen.json') });

// Every plan needs a prior look to diff against. Baseline on an empty feed so
// whatever the test passes next counts as new.
async function planAfterBaseline(opts) {
  await planBatch({ notifications: [], seen: seenStore(), ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });
  return planBatch({ seen: seenStore(), ...opts });
}
const llm = async ({ target }) => `Hey ${target.handle}, saw you around. What are you building? https://varritech.com`;
const memStore = () => { const d = new Map(); return { d, get: async (c, k) => d.get(`${c}/${k}`) ?? null, set: async (c, k, v) => d.set(`${c}/${k}`, v) }; };

describe('plan -> send -> commit -> replan', () => {
  it('never re-offers a person once their send is committed', async () => {
    const store = memStore();
    // Establish the baseline on an EMPTY feed, so the three below arrive as new.
    await planBatch({ notifications: [], seen: seenStore(), ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });

    const first = await planBatch({ notifications: NOTIFS, seen: seenStore(), ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });
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
    const second = await planBatch({ notifications: NOTIFS, seen: seenStore(), ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY });
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

    const plan = await planAfterBaseline({ notifications: NOTIFS, ledger: led, llm, cap: 10, now: WORKDAY });
    expect(plan.batch.map((t) => t.handle)).not.toContain('ana');
  });

  it('drops anyone whose opener came back unusable rather than sending an empty DM', async () => {
    const placeholderLlm = async ({ target }) =>
      target.handle === 'bob' ? 'Hey, into [their niche]?' : 'Hey, what are you building?';

    const plan = await planAfterBaseline({
      notifications: NOTIFS, ledger: createLedger({ path }), llm: placeholderLlm, cap: 10, now: WORKDAY,
    });

    expect(plan.batch.map((t) => t.handle)).not.toContain('bob');
    for (const t of plan.batch) expect(t.text.length).toBeGreaterThan(0);
  });

  it('says nothing on the first look, then plans only who appeared afterwards', async () => {
    const seen = seenStore();

    const first = await planBatch({
      notifications: NOTIFS, seen, ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY,
    });
    expect(first.baseline).toBe(true);
    expect(first.batch).toEqual([]);

    const later = [...NOTIFS, { handle: 'dee', text: 'dee started following you. 1m Follow Back', postHref: null }];
    const second = await planBatch({
      notifications: later, seen: seenStore(), ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY,
    });

    expect(second.baseline).toBe(false);
    expect(second.batch.map((t) => t.handle)).toEqual(['dee']);
  });
});

describe('commitSend survives a broken handoff', () => {
  it('still records the send when Firestore throws, so nobody gets DMed twice', async () => {
    // Live 2026-08-17: ADC went stale (invalid_rapt) and the Firestore write threw.
    // The DM had ALREADY landed in Instagram at that point. If the throw escapes,
    // the run dies un-recorded and the next poll re-messages a real person.
    const ledger = createLedger({ path });
    const explodingStore = {
      async get() { throw new Error('16 UNAUTHENTICATED: invalid_rapt'); },
      async set() { throw new Error('16 UNAUTHENTICATED: invalid_rapt'); },
    };

    const res = await commitSend({
      ledger, store: explodingStore, handle: 'someone', text: 'hi there',
    });

    expect(res.recorded).toBe(true);
    expect(res.handoffError).toMatch(/invalid_rapt/);
    // The load-bearing assertion: they are contacted, so we never send again.
    expect(createLedger({ path }).has('someone')).toBe(true);
  });
});

