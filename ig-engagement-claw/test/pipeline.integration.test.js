import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { createSeenStore } from '../src/seen.js';
import { planBatch, commitSend, skipTarget, blockTarget } from '../src/pipeline.js';

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
    // Followers outrank likers (Cristiano 2026-10-10), newest first: ana followed 5m ago.
    expect(first.batch[0].handle).toBe('ana');
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

  it('never re-offers a follow-up to someone already contacted whose delivery is permanently blocked', async () => {
    // Live recurrence on pbjoel across three separate runs: the agent opens
    // the follow-up thread, sees "can't receive your message... not everyone",
    // and skipTarget can't record it because the handle is already contacted
    // (ledger.has === true). Without blockTarget the same dead thread comes
    // back due for a knock every run forever.
    const opened = createLedger({ path });
    opened.record('ana', { at: '2026-08-01T00:00:00.000Z', text: 'the opener' });

    await blockTarget({ ledger: createLedger({ path }), handle: 'ana', reason: 'message-request-blocked-not-delivered', now: WORKDAY });

    const led = createLedger({ path });
    expect(led.has('ana')).toBe(true);
    expect(led.all().find((e) => e.handle === 'ana').text).toBe('the opener');

    const plan = await planAfterBaseline({ notifications: [], ledger: led, llm, cap: 10, now: WORKDAY });
    expect(plan.followUps.map((f) => f.handle)).not.toContain('ana');
  });

  it('plans every selected person with the fixed welcome opener', async () => {
    const plan = await planAfterBaseline({
      notifications: NOTIFS, ledger: createLedger({ path }), llm, cap: 10, now: WORKDAY,
    });
    expect(plan.batch.length).toBeGreaterThan(0);
    for (const t of plan.batch) expect(t.text).toMatch(/Scalewright/);
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
    expect(res.followUps[0]).toMatchObject({ handle: 'quietone', followUpNumber: 1 });
    // Knock one is Cristiano's fixed copy, so the llm stub is deliberately ignored.
    expect(res.followUps[0].text).toContain('$149.99');
    expect(res.followUps[0].text).toContain('guide-1');
  });

  it('still knocks on a quiet person when nobody new has arrived', async () => {
    // The other half of the 2026-09-04 priority flip: cold outreach goes first,
    // but follow-ups must not be dead. With an empty notifications feed there is
    // nothing fresher to spend the slot on, so the quiet person gets it.
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const res = await planBatch({
      notifications: [], seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 1, now: WORKDAY,
      rate: { perHour: 1, perDay: 20 },
    });

    expect(res.batch).toHaveLength(0);
    expect(res.followUps.map((f) => f.handle)).toEqual(['quietone']);
  });

  it('sends a follow-up at 3am unless a window is explicitly set', async () => {
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });
    const threeAm = new Date('2026-08-13T03:00:00-04:00');

    const res = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 5, now: threeAm,
      rate: { perHour: 10, perDay: 20 },
    });

    // No window by default (2026-09-09) — 3am is a normal sending time now.
    expect(res.followUps.map((f) => f.handle)).toEqual(['quietone']);

    const gated = await planBatch({
      notifications: rows, seen: seenReady(), ledger,
      llm: async () => 'drafted text', cap: 5, now: threeAm,
      rate: { perHour: 10, perDay: 20 },
      window: { timeZone: 'America/New_York', startHour: 9, endHour: 20 },
    });
    expect(gated.followUps).toEqual([]);
    expect(gated.batch).toEqual([]);
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

  it('counts planned cold openers against MAX_PER_HOUR when picking follow-ups', async () => {
    // The trap, mirrored after the 2026-09-04 priority flip: cold openers are
    // drafted but NOT yet in the ledger, so the follow-up pass recomputing the
    // budget off the ledger sees zero sends this hour and hands out the full
    // allowance a second time. perHour=2 with 1 cold opener must leave room for
    // exactly ONE follow-up, not two — two people are due here on purpose.
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });
    ledger.record('quiettwo', { at: new Date(WORKDAY.getTime() - 6 * DAY).toISOString(), text: 'the opener' });

    const rows = [{ handle: 'newa', text: 'newa liked your photo. 5m', postHref: '/p/P1/' }];

    const res = await planBatch({
      notifications: rows, seen: seenReady2(), ledger,
      llm: async () => 'drafted text', cap: 5, now: WORKDAY,
      rate: { perHour: 2, perDay: 20 },
    });

    expect(res.batch.map((t) => t.handle)).toEqual(['newa']);
    expect(res.followUps).toHaveLength(1);
    expect(res.followUps.length + res.batch.length).toBe(2);
  });

  it('gives the last slot to a NEW follower/liker, not to a follow-up', async () => {
    // Cristiano, 2026-09-04: the claw had gone 4 days without opening anyone new
    // while still knocking on people from August. Reaching someone who just
    // followed or liked, while they still remember doing it, is the whole point
    // of polling every 5 minutes — a second knock on a 5-day-old silence is not
    // time-critical and can wait for a quieter run.
    const ledger = createLedger({ path });
    ledger.record('quietone', { at: new Date(WORKDAY.getTime() - 5 * DAY).toISOString(), text: 'the opener' });

    const rows = [{ handle: 'freshliker', text: 'freshliker liked your photo. 2m', postHref: '/p/P1/' }];

    const res = await planBatch({
      notifications: rows, seen: seenReady2(), ledger,
      llm: async () => 'drafted text', cap: 5, now: WORKDAY,
      rate: { perHour: 1, perDay: 20 },
    });

    expect(res.batch.map((t) => t.handle)).toEqual(['freshliker']);
    expect(res.followUps).toEqual([]);
  });
});

