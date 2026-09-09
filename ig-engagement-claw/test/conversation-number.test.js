import { describe, it, expect } from 'vitest';
import { config } from '../src/config.js';

/*
 * Two lines, two jobs (Cristiano, 2026-09-09):
 *
 *   +1 365 825 0303  automated nurture follow-ups (the vds cron, lib/quo-sms)
 *   +1 332 279 5265  the founder conversation — this claw
 *
 * They shared a default, so the personal opener would have arrived on the same
 * line as the broadcast follow-ups. That collapses the whole point of the
 * second number: a reply to "what are you building?" would land in the
 * automated thread, and the sales claw would never see it.
 */
describe('the founder conversation runs on its own line', () => {
  it('defaults to the conversation number, not the follow-up number', () => {
    const prev = process.env.QUO_FROM_NUMBER;
    delete process.env.QUO_FROM_NUMBER;
    try {
      expect(config().sms.from).toBe('+13322795265');
      expect(config().sms.from).not.toBe('+13658250303');
    } finally {
      if (prev === undefined) delete process.env.QUO_FROM_NUMBER;
      else process.env.QUO_FROM_NUMBER = prev;
    }
  });
});
