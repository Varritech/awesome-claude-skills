import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { remainingBudget } from '../src/select.js';

/**
 * 2026-09-10, Cristiano: "there should not be any daily window."
 *
 * The claw hit MAX_PER_DAY=15 yesterday (9 openers + 6 follow-ups) and went
 * silent for the rest of the day with people still to reach.
 *
 * ⛔ The limits live in THREE places and the LIVE plist wins, because launchd
 * exports MAX_PER_DAY into the process. Changing the config default alone is a
 * silent no-op — the same trap that bit the send-window change.
 */
describe('there is no daily cap', () => {
  it('a null perDay means unlimited, not zero', () => {
    // 500 sent in the last day, none in the last hour: the day must not gate.
    const ledger = { sentSince: (ms) => (ms > 3600_000 ? 500 : 0) };
    const budget = remainingBudget({ ledger, rate: { perHour: 4, perDay: null }, cap: 2 });
    expect(budget).toBe(2); // paced by the per-run cap only
  });

  it('the code default no longer imposes one', async () => {
    // config() reads process.env at call time, so no module cache-busting.
    const { config } = await import('../src/config.js');
    const prev = process.env.MAX_PER_DAY;
    delete process.env.MAX_PER_DAY;
    expect(config().rate.perDay).toBeNull();
    process.env.MAX_PER_DAY = '0';
    expect(config().rate.perDay).toBeNull(); // 0 means unlimited, not "none allowed"
    process.env.MAX_PER_DAY = '15';
    expect(config().rate.perDay).toBe(15);   // a real number still caps
    if (prev !== undefined) process.env.MAX_PER_DAY = prev; else delete process.env.MAX_PER_DAY;
  });

  it('⛔ the launchd plist does not re-impose one', () => {
    const plist = readFileSync(new URL('../com.varritech.ig-engagement-claw.plist', import.meta.url), 'utf8');
    const m = plist.match(/<key>MAX_PER_DAY<\/key><string>(\d+)<\/string>/);
    // absent, or explicitly 0 which the config reads as unlimited
    if (m) expect(Number(m[1])).toBe(0);
  });

  it('an explicit cap still works for whoever wants one back', () => {
    const ledger = { sentSince: (ms) => (ms > 3600_000 ? 15 : 0) };
    const budget = remainingBudget({ ledger, rate: { perHour: 4, perDay: 15 }, cap: 2 });
    expect(budget).toBe(0);
  });
});
