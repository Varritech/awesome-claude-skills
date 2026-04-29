/**
 * Inngest function: inbox/warmup-tick
 *
 * Fires daily (via Vercel Cron → /api/inngest) for every warming inbox.
 * Sends warmup emails to a pool of real Mailforge warmup addresses
 * (or a placeholder pool until Mailforge warmup API is available).
 *
 * Also transitions inbox status:
 *   connecting → warming (when SMTP is verified)
 *   warming → active (when quota reaches dailySendLimit)
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail, verifySmtp, type SmtpConfig } from '@/lib/smtp/mailer';
import { todayQuota, isWarmedUp } from '@/lib/warmup/scheduler';

// Warmup recipient pool — Mailforge internal addresses for inbox warming
// In production these come from the Mailforge warmup network
const WARMUP_POOL = [
  'warmup1@convergeflow.io',
  'warmup2@convergeflow.io',
  'warmup3@convergeflow.io',
  'warmup-reply@mailforge.com',
];

const WARMUP_SUBJECTS = [
  'Re: Following up',
  'Checking in',
  'Quick update',
  'Touching base',
  'Just wanted to share',
];

const WARMUP_BODIES = [
  'Thanks for reaching out. Looking forward to connecting.',
  'Got your message. Will get back to you shortly.',
  'Appreciate you following up. Let me check on this.',
  'Thanks for the note. Happy to chat when you have time.',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

export const warmupTickFn = inngest.createFunction(
  {
    id: 'inbox-warmup-tick',
    name: 'Inbox Warmup Tick',
    retries: 2,
    triggers: [{ event: 'inbox/warmup-tick' }],
  },
  async ({ event, step }) => {
    const { inboxId } = event.data;

    // ── 1. Load inbox ─────────────────────────────────────────────────────────
    const inbox = await step.run('load-inbox', async () => {
      const snap = await adminDb.collection('inboxes').doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return { id: inboxId, ...snap.data() } as InboxRecord;
    });

    if (!inbox.smtpHost || !inbox.smtpPasswordEncrypted) {
      return { skipped: true, reason: 'No SMTP credentials' };
    }

    const smtpConfig: SmtpConfig = {
      host: inbox.smtpHost,
      port: inbox.smtpPort ?? 587,
      user: inbox.smtpUser!,
      encryptedPassword: inbox.smtpPasswordEncrypted,
    };

    // ── 2. Verify SMTP on first tick ──────────────────────────────────────────
    if (inbox.status === 'connecting') {
      const ok = await step.run('verify-smtp', () => verifySmtp(smtpConfig));
      if (!ok) {
        await adminDb.collection('inboxes').doc(inboxId).set(
          { status: 'error', updatedAt: new Date().toISOString() },
          { merge: true },
        );
        return { skipped: true, reason: 'SMTP verification failed' };
      }
      await adminDb.collection('inboxes').doc(inboxId).set(
        { status: 'warming', warmupStartDate: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      inbox.status = 'warming';
      inbox.warmupStartDate = new Date().toISOString();
    }

    const state = {
      warmupEnabled: inbox.warmupEnabled,
      warmupStartDate: inbox.warmupStartDate ?? null,
      dailySendLimit: inbox.dailySendLimit,
      status: inbox.status,
    };

    const quota = todayQuota(state);
    if (quota === 0) return { skipped: true, reason: 'Quota is 0' };

    // ── 3. Send warmup emails ─────────────────────────────────────────────────
    const warmupCount = Math.min(quota, WARMUP_POOL.length);
    const results: Array<{ to: string; ok: boolean }> = [];

    for (let i = 0; i < warmupCount; i++) {
      const to = pick(WARMUP_POOL, i);
      const subject = pick(WARMUP_SUBJECTS, i);
      const body = pick(WARMUP_BODIES, i);

      const result = await step.run(`warmup-send-${i}`, async () => {
        try {
          await sendEmail(smtpConfig, {
            from: `${inbox.displayName ?? 'ConvergeFlow'} <${inbox.email}>`,
            to,
            subject,
            html: `<p>${body}</p>`,
            text: body,
            headers: { 'X-Warmup': '1' },
          });
          return { to, ok: true };
        } catch {
          return { to, ok: false };
        }
      });

      results.push(result);
    }

    // ── 4. Check if warmup complete ───────────────────────────────────────────
    const now = new Date().toISOString();
    if (isWarmedUp(state)) {
      await step.run('mark-active', async () => {
        await adminDb.collection('inboxes').doc(inboxId).set(
          { status: 'active', updatedAt: now },
          { merge: true },
        );
      });
    } else {
      await step.run('update-timestamp', async () => {
        await adminDb.collection('inboxes').doc(inboxId).set(
          { updatedAt: now },
          { merge: true },
        );
      });
    }

    return {
      inboxId,
      warmupSent: results.filter((r) => r.ok).length,
      quota,
      warmedUp: isWarmedUp(state),
    };
  },
);

interface InboxRecord {
  id: string;
  email: string;
  displayName?: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
}
