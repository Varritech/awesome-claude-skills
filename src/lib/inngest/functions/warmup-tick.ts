/**
 * Inngest function: inbox/warmup-tick
 *
 * Fires daily (via Vercel Cron → /api/inngest) for every warming inbox.
 * Delegates to the dependency-injected `executeWarmupTick` orchestrator so the
 * warmup decision + send dispatch is unit-tested in isolation (see
 * tick-planner.test.ts + tick-executor.test.ts).
 *
 * Supports both send paths:
 *   - Gmail OAuth2 inboxes (XOAUTH2 via nodemailer) — previously skipped because
 *     they have no SMTP credentials.
 *   - SMTP/Mailforge inboxes (unchanged).
 *
 * Warmup recipients come from the WARMUP_POOL env var (comma-separated). When
 * empty, sends are skipped but the warmup start date is still backfilled and the
 * ramp/progress advance — safe default until real warmup addresses are configured.
 *
 * Inbox status transitions:
 *   connecting → warming (SMTP verified, or Gmail has no SMTP to verify)
 *   warming → active (when quota reaches dailySendLimit, ~day 14)
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail, sendEmailOauth2, verifySmtp } from '@/lib/smtp/mailer';
import { executeWarmupTick } from '@/lib/warmup/tick-executor';
import { loadWarmupPool } from '@/lib/warmup/pool';
import type { TickInbox, TickEnv } from '@/lib/warmup/tick-planner';

export const warmupTickFn = inngest.createFunction(
  {
    id: 'inbox-warmup-tick',
    name: 'Inbox Warmup Tick',
    retries: 2,
    triggers: [{ event: 'inbox/warmup-tick' }],
  },
  async ({ event, step }) => {
    const { inboxId } = event.data;

    const inbox = await step.run('load-inbox', async () => {
      const snap = await adminDb.collection('inboxes').doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return { id: inboxId, ...snap.data() } as TickInbox;
    });

    const env: TickEnv & { WARMUP_POOL?: string } = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      WARMUP_POOL: process.env.WARMUP_POOL,
    };

    return await step.run('execute-warmup-tick', async () => {
      return executeWarmupTick(inbox, env, new Date(), loadWarmupPool(), {
        sendOauth2: sendEmailOauth2,
        sendSmtp: sendEmail,
        verifySmtp,
        writeInbox: (id, patch) =>
          adminDb.collection('inboxes').doc(id).set(patch, { merge: true }),
      });
    });
  },
);