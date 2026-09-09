import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isSendingWindow } from '../src/select.js';

/**
 * 2026-09-09, Cristiano: "there is no send window."
 *
 * The claw polls every 5 minutes precisely to catch someone in the minutes
 * after they follow or comment. A 9-to-20 gate threw away every overnight
 * engagement, and Instagram engagement does not keep office hours.
 *
 * ⛔ The hours live in TWO places and the plist wins, because launchd exports
 * START_HOUR/END_HOUR into the process. Changing the config default alone is a
 * silent no-op — the exact "two places hardcoded the same thing" trap that has
 * bitten this codebase before.
 */
describe('there is no send window', () => {
  it('the code default is open at every hour', () => {
    for (const h of [0, 3, 5, 9, 13, 20, 23]) {
      const at = new Date(Date.UTC(2026, 8, 9, h, 30));
      expect(isSendingWindow(at, { timeZone: 'UTC' }), `hour ${h}`).toBe(true);
    }
  });

  it('is open on every day of the week', () => {
    // 2026-09-06 is a Sunday; walk a full week at 4am.
    for (let d = 6; d <= 12; d++) {
      const at = new Date(Date.UTC(2026, 8, d, 4, 0));
      expect(isSendingWindow(at, { timeZone: 'UTC' }), `day ${d}`).toBe(true);
    }
  });

  it('⛔ the launchd plist does not re-impose one', () => {
    const plist = readFileSync(new URL('../com.varritech.ig-engagement-claw.plist', import.meta.url), 'utf8');
    const start = plist.match(/<key>START_HOUR<\/key><string>(\d+)<\/string>/)?.[1];
    const end = plist.match(/<key>END_HOUR<\/key><string>(\d+)<\/string>/)?.[1];
    // Either absent entirely, or explicitly the full day.
    if (start !== undefined) expect(Number(start)).toBe(0);
    if (end !== undefined) expect(Number(end)).toBe(24);
    expect(plist).not.toMatch(/<key>SEND_DAYS<\/key><string>(?!\s*<)/);
  });

  it('an explicit window still works, for whoever wants one back', () => {
    const at = new Date(Date.UTC(2026, 8, 9, 3, 0));
    expect(isSendingWindow(at, { timeZone: 'UTC', startHour: 9, endHour: 20 })).toBe(false);
  });
});
