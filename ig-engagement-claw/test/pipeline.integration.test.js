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

describe('follow-ups inside planBatch', () => {
  const DAY = 86400_000;
  const rows = [{ handle: 'newperson', text: 'newperson liked your photo. 5m', postHref: '/p/P1/' }];
  const seenReady = () => { const st = createSeenStore({ path: join(dir, 'seen.json') }); st.remember([]); return st; };

  it('plans a follow-up for someone who went silent, alongside new targets', async () => {
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const res = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 5, now: WORKDAY,
      rate: { perHour: 10, perDay: 20 },
    });

    expect(res.followUps).toHaveLength(1);
    expect(res.followUps[0]).toMatchObject({ handle: 'quietone', followUpNumber: 1, text: 'drafted text' });
  });

  it('spends budget on follow-ups BEFORE new cold DMs', async () => {
    // A warm person who already heard from us beats a stranger. With one slot
    // left, the follow-up takes it and the cold opener waits for the next run.
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const res = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 1, now: WORKDAY,
      rate: { perHour: 1, perDay: 20 },
    });

    expect(res.followUps).toHaveLength(1);
    expect(res.batch).toHaveLength(0);
  });

  it('sends no follow-up outside the sending window', async () => {
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });
    const threeAm = new Date('2026-08-13T03:00:00-04:00');

    const res = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 5, now: threeAm,
      rate: { perHour: 10, perDay: 20 },
    });

    expect(res.followUps).toEqual([]);
    expect(res.batch).toEqual([]);
  });

  it('plans no follow-up at all while the claw is killed', async () => {
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const res = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'x', cap: 5, now: WORKDAY, killSwitch: true,
    });

    expect(res.killed).toBe(true);
    expect(res.followUps).toEqual([]);
  });
});

describe('follow-ups must not leak past the hourly cap', () => {
  const DAY = 86400_000;
  const seenReady2 = () => { const st = createSeenStore({ path: join(dir, 'seen2.json') }); st.remember([]); return st; };

  it('counts planned follow-ups against MAX_PER_HOUR when picking cold targets', async () => {
    // The trap: follow-ups are planned but NOT yet in the ledger, so selectBatch
    // recomputing the budget from the ledger sees zero sends this hour and hands
    // out the full allowance again. perHour=2 with 1 follow-up must leave room
    // for exactly ONE cold DM, not two.
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const rows = [
      { handle: 'newa', text: 'newa liked your photo. 5m', postHref: '/p/P1/' },
      { handle: 'newb', text: 'newb liked your photo. 6m', postHref: '/p/P2/' },
      { handle: 'newc', text: 'newc liked your photo. 7m', postHref: '/p/P3/' },
    ];

    const res = await planBatch({
      notifications: rows, seen: seenReady2(), ledger,
      llm: async () => 'drafted text', cap: 5, now: WORKDAY,
      rate: { perHour: 2, perDay: 20 },
    });

    expect(res.followUps).toHaveLength(1);
    expect(res.followUps.length + res.batch.length).toBeLessThanOrEqual(2);
  });
});

