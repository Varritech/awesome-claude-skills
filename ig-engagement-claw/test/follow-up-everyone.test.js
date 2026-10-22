import { describe, it, expect } from 'vitest';
import { dueForFollowUp } from '../src/followups.js';

/**
 * 2026-09-10, Cristiano: "there should not be any daily window, and it should
 * follow up with literally everyone who we've ever talked to on IG."
 *
 * Two populations were permanently frozen out:
 *   36 people who finished the 2-knock cadence ("stop for good")
 *   34 people marked `skipped` because they already had a DM thread with him
 *      before this claw existed — it had never messaged them once
 */
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();
const ledgerOf = (...rows) => ({ all: () => rows });

describe('nobody is retired from the follow-up list', () => {
  it('keeps following up after the named cadence is exhausted', () => {
    const due = dueForFollowUp({
      ledger: ledgerOf({
        handle: 'a', at: days(60), text: 'opener', source: 'follower',
        followUps: [{ at: days(50) }, { at: days(40) }],
      }),
      cadenceDays: [3, 7],
    });
    expect(due).toHaveLength(1);
    expect(due[0].followUpNumber).toBe(3);
  });

  it('paces the extra knocks at the widest interval, it does not accelerate', () => {
    // Last knock 5 days ago. That is past the FIRST step (3) but short of the
    // final one (7). An exhausted thread must be paced at the widest interval,
    // so 5 days is not yet due — it must not fall back to the 3-day step.
    const notYet = dueForFollowUp({
      ledger: ledgerOf({
        handle: 'a', at: days(60), text: 'opener',
        followUps: [{ at: days(50) }, { at: days(5) }],
      }),
      cadenceDays: [3, 7],
    });
    expect(notYet).toHaveLength(0);

    // 8 days is past the widest interval, so it is due again.
    const due = dueForFollowUp({
      ledger: ledgerOf({
        handle: 'a', at: days(60), text: 'opener',
        followUps: [{ at: days(50) }, { at: days(8) }],
      }),
      cadenceDays: [3, 7],
    });
    expect(due).toHaveLength(1);
    expect(due[0].followUpNumber).toBe(3);
  });
});

describe('people we already had a thread with are reachable', () => {
  const skipped = { handle: 'olddm', at: days(30), status: 'skipped', reason: 'existing-thread' };

  it('surfaces an existing-thread contact we never messaged ourselves', () => {
    const due = dueForFollowUp({ ledger: ledgerOf(skipped), cadenceDays: [3, 7] });
    expect(due).toHaveLength(1);
    expect(due[0].handle).toBe('olddm');
  });

  it('marks them so the copy can differ — there is no opener to follow up ON', () => {
    const [t] = dueForFollowUp({ ledger: ledgerOf(skipped), cadenceDays: [3, 7] });
    expect(t.reopen).toBe(true);
    expect(t.opener).toBeFalsy();
  });

  it('⛔ does not reopen someone whose DMs are shut', () => {
    const due = dueForFollowUp({
      ledger: ledgerOf({ handle: 'x', at: days(30), status: 'skipped', reason: 'dms-closed' }),
      cadenceDays: [3, 7],
    });
    expect(due).toHaveLength(0);
  });
});

describe('the two guards that stay', () => {
  it('⛔ never talks over a live conversation', () => {
    const due = dueForFollowUp({
      ledger: ledgerOf({ handle: 'a', at: days(30), text: 'o', replied: true }),
      cadenceDays: [3, 7],
    });
    expect(due).toHaveLength(0);
  });

  it('⛔ never re-knocks a permanently undeliverable thread', () => {
    const due = dueForFollowUp({
      ledger: ledgerOf({ handle: 'a', at: days(30), text: 'o', blocked: true }),
      cadenceDays: [3, 7],
    });
    expect(due).toHaveLength(0);
  });
});

/**
 * ⛔ A reopened contact must NOT get the fixed knock-one pitch. They are
 * someone Cristiano already spoke to, sometimes long ago. Opening months of
 * silence with "we typically charge $149.99 for this guide" is the wrong first
 * move, and the standard follow-up prompt is worse — it asserts we sent them a
 * guide N days ago, which never happened.
 */
describe('reopening an old thread reads like a person, not a pitch', () => {
  it('does not fire the fixed knock-one pitch at them, and sends a value item instead', async () => {
    const { draftFollowUp } = await import('../src/opener.js');
    const { buildLibrary } = await import('../src/value.js');
    const out = await draftFollowUp({
      target: { handle: 'olddm', followUpNumber: 1, reopen: true, silentDays: 200 },
      library: buildLibrary({ news: [], now: new Date() }), linksBlocked: true,
      llm: async ({ prompt }) => (/ROUTER/i.test(prompt) ? 'We built a router that sends each request to the cheapest model that can do it. Reply and I will set you up with free access.' : 'The free strategy guide walks through discovery, happy to send it if you reply.'),
    });
    expect(out).not.toMatch(/\$149\.99|268|\$299|\$999/);
    expect(out).toMatch(/router|guide/i);
  });

  it('the reopen prompt never claims a message we never sent, and offers a real item', async () => {
    const { buildValuePrompt, buildLibrary, pickValueItem } = await import('../src/value.js');
    const library = buildLibrary({ news: [], now: new Date() });
    const target = { handle: 'olddm', silentDays: 200, reopen: true, followUpNumber: 1 };
    const p = buildValuePrompt({ target, item: pickValueItem({ target, library }), linksBlocked: true });
    expect(p).not.toMatch(/sent them a free guide|you messaged/i);
    expect(p).toMatch(/no pitch|no price/i);
  });

  it('a normal follow-up is untouched', async () => {
    const { draftFollowUp } = await import('../src/opener.js');
    const out = await draftFollowUp({
      target: { handle: 'a', followUpNumber: 1, source: 'follower' },
      llm: async () => 'unused',
    });
    expect(out).toMatch(/\$149\.99/);
  });
});
