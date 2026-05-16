/**
 * Inngest function: inbox-suspend
 *
 * Triggered by: inbox/suspend event (fired from complaint webhook
 * when complaintRate exceeds 0.1%).
 *
 * Sets inbox status to 'suspended' and pauses all queued emails for that inbox.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';

export const inboxSuspendFn = inngest.createFunction(
  {
    id: 'inbox-suspend',
    name: 'Suspend Inbox',
    retries: 2,
    triggers: [{ event: 'inbox/suspend' }],
  },
  async ({ event, step }) => {
    const { inboxId, reason, complaintRate } = event.data as {
      inboxId: string;
      reason: string;
      complaintRate: number;
    };

    // ── 1. Mark inbox as suspended ────────────────────────────────────────────
    await step.run('suspend-inbox', async () => {
      await adminDb
        .collection('inboxes')
        .doc(inboxId)
        .set(
          {
            status: 'suspended',
            suspendedAt: new Date().toISOString(),
            suspendReason: reason,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    });

    // ── 2. Pause all queued emails for this inbox ──────────────────────────────
    const paused = await step.run('pause-queued-emails', async () => {
      const snap = await adminDb
        .collection('emails')
        .where('inboxId', '==', inboxId)
        .where('status', '==', 'queued')
        .get();

      const batch = adminDb.batch();
      const now = new Date().toISOString();
      snap.docs.forEach((d) => {
        batch.set(d.ref, { status: 'paused', updatedAt: now }, { merge: true });
      });
      await batch.commit();
      return snap.size;
    });

    return { inboxId, suspended: true, emailsPaused: paused, reason, complaintRate };
  },
);
