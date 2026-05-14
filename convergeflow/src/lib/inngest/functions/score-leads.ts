/**
 * Inngest function: score-leads
 *
 * Triggered on email/opened, email/replied, email/bounced events.
 * Recalculates the engagementScore for the affected lead and updates Firestore.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { scoreLeadEngagement, type EmailRecord } from '@/lib/leads/scoring';

export const scoreLeadsFn = inngest.createFunction(
  {
    id: 'score-leads',
    name: 'Score Lead Engagement',
    retries: 2,
    triggers: [
      { event: 'email/opened' },
      { event: 'email/replied' },
      { event: 'email/bounced' },
    ],
  },
  async ({ event, step }) => {
    const { emailId } = event.data as { emailId: string };

    // ── 1. Load the email record ──────────────────────────────────────────────
    const emailDoc = await step.run('load-email', async () => {
      const snap = await adminDb.collection('emails').doc(emailId).get();
      if (!snap.exists) throw new Error(`Email ${emailId} not found`);
      return { id: snap.id, ...snap.data() } as EmailRecord & { leadId?: string; userId?: string };
    });

    if (!emailDoc.leadId) {
      return { skipped: true, reason: 'Email has no associated lead' };
    }

    const { leadId } = emailDoc;

    // ── 2. Load the lead ──────────────────────────────────────────────────────
    const lead = await step.run('load-lead', async () => {
      const snap = await adminDb.collection('leads').doc(leadId).get();
      if (!snap.exists) throw new Error(`Lead ${leadId} not found`);
      return { id: snap.id, ...snap.data() } as { id: string; status?: string };
    });

    // ── 3. Load all emails for this lead ─────────────────────────────────────
    const allEmails = await step.run('load-lead-emails', async () => {
      const snap = await adminDb
        .collection('emails')
        .where('leadId', '==', leadId)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as EmailRecord[];
    });

    // ── 4. Score the lead ─────────────────────────────────────────────────────
    const engagementScore = scoreLeadEngagement(lead, allEmails);

    // ── 5. Persist score ──────────────────────────────────────────────────────
    await step.run('update-lead-score', async () => {
      await adminDb
        .collection('leads')
        .doc(leadId)
        .set(
          { engagementScore, updatedAt: new Date().toISOString() },
          { merge: true },
        );
    });

    return { leadId, engagementScore };
  },
);
