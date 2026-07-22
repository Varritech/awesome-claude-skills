/**
 * Inngest function: warmup/reply
 *
 * Fired by the Resend inbound webhook when a warmup email (sent from a user's
 * inbox to a pool address) is received. Waits a randomized human-ish delay, then
 * replies to the sender via Resend so the sender's Gmail sees engagement on the
 * warmup thread.
 *
 * Reply content is built by the pure `buildWarmupReply` planner (tested in
 * reply-planner.test.ts); this function only handles timing + the Resend send.
 */

import { inngest } from '../client';
import { sendEmail as resendSendEmail } from '@/lib/resend/client';
import { buildWarmupReply } from '@/lib/warmup/reply-planner';

// Reply window: 5–180 minutes after the warmup email landed, so replies don't
// look instant/bot-like to the sender's provider.
const MIN_DELAY_MIN = 5;
const MAX_DELAY_MIN = 180;

export const warmupReplyFn = inngest.createFunction(
  {
    id: 'warmup-reply',
    name: 'Warmup Pool Reply',
    retries: 2,
    triggers: [{ event: 'warmup/reply' }],
  },
  async ({ event, step }) => {
    const { from, toRecipient, subject, messageId } = event.data;

    const delayMinutes =
      MIN_DELAY_MIN + Math.floor(Math.random() * (MAX_DELAY_MIN - MIN_DELAY_MIN + 1));
    const sendAt = new Date(Date.now() + delayMinutes * 60_000);
    await step.sleepUntil('wait-to-reply', sendAt);

    return await step.run('send-reply', async () => {
      const reply = buildWarmupReply({ from, toRecipient, subject, messageId });
      return resendSendEmail({
        from: reply.from,
        to: reply.to,
        subject: reply.subject,
        html: reply.html,
        text: reply.text,
        headers: reply.headers,
      });
    });
  },
);