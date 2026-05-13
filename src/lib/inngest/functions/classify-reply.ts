/**
 * Inngest function: email/reply-received
 *
 * Triggered when a new inbound reply is detected for a campaign email.
 * Classifies the reply and routes accordingly:
 *   positive      → flag for user, pause sequence, dashboard notification
 *   soft_negative → move lead to Farm stage, re-touch in 30 days
 *   hard_negative → suppress lead permanently
 *   ooo           → pause sequence, resume after detected return date
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { classifyReply } from '@/lib/ai/reply-classifier';

export const classifyReplyFn = inngest.createFunction(
  {
    id: 'classify-reply',
    name: 'Classify Inbound Reply',
    retries: 3,
    triggers: [{ event: 'email/reply-received' }],
  },
  async ({ event, step }) => {
    const { emailId, leadId, campaignId, replyText, userId } = event.data as {
      emailId: string;
      leadId: string;
      campaignId: string;
      replyText: string;
      userId: string;
    };

    // ── 1. Classify ──────────────────────────────────────────────────────────
    const classification = await step.run('classify', async () => {
      return classifyReply(replyText);
    });

    const { category } = classification;
    const now = new Date().toISOString();

    // ── 2. Update email record ────────────────────────────────────────────────
    await step.run('update-email', async () => {
      await adminDb.collection('emails').doc(emailId).set(
        {
          replyCategory: category,
          repliedAt: now,
          status: 'replied',
          updatedAt: now,
        },
        { merge: true }
      );
    });

    // ── 3. Route by category ──────────────────────────────────────────────────
    if (category === 'positive') {
      await step.run('handle-positive', async () => {
        const batch = adminDb.batch();

        // Flag lead as interested
        batch.set(
          adminDb.collection('leads').doc(leadId),
          { status: 'replied', replyCategory: 'positive', updatedAt: now },
          { merge: true }
        );

        // Pause the campaign sequence for this lead
        const queued = await adminDb
          .collection('emails')
          .where('leadId', '==', leadId)
          .where('campaignId', '==', campaignId)
          .where('status', '==', 'queued')
          .get();

        queued.docs.forEach((d) =>
          batch.set(d.ref, { status: 'paused', updatedAt: now }, { merge: true })
        );

        // Create inbox notification
        batch.set(adminDb.collection('notifications').doc(), {
          userId,
          type: 'positive_reply',
          emailId,
          leadId,
          campaignId,
          preview: replyText.slice(0, 200),
          read: false,
          createdAt: now,
        });

        await batch.commit();
      });

      // Fire feedback loop — winning email context to RAG store
      await step.sendEvent('trigger-feedback-loop', {
        name: 'email/positive-reply',
        data: { emailId, leadId, campaignId, userId },
      });
    }

    if (category === 'soft_negative') {
      await step.run('handle-soft-negative', async () => {
        // Move to Farm — re-touch in 30 days
        const farmDate = new Date();
        farmDate.setDate(farmDate.getDate() + 30);

        await adminDb.collection('leads').doc(leadId).set(
          {
            status: 'farm',
            replyCategory: 'soft_negative',
            farmReactivateAt: farmDate.toISOString(),
            updatedAt: now,
          },
          { merge: true }
        );

        // Pause remaining queued emails for this lead in this campaign
        const queued = await adminDb
          .collection('emails')
          .where('leadId', '==', leadId)
          .where('campaignId', '==', campaignId)
          .where('status', '==', 'queued')
          .get();

        const batch = adminDb.batch();
        queued.docs.forEach((d) =>
          batch.set(d.ref, { status: 'paused', updatedAt: now }, { merge: true })
        );
        await batch.commit();
      });
    }

    if (category === 'hard_negative') {
      await step.run('handle-hard-negative', async () => {
        const batch = adminDb.batch();

        // Suppress lead permanently
        batch.set(
          adminDb.collection('leads').doc(leadId),
          { status: 'unsubscribed', replyCategory: 'hard_negative', suppressedAt: now, updatedAt: now },
          { merge: true }
        );

        // Cancel all remaining queued emails
        const queued = await adminDb
          .collection('emails')
          .where('leadId', '==', leadId)
          .where('status', '==', 'queued')
          .get();

        queued.docs.forEach((d) =>
          batch.set(d.ref, { status: 'cancelled', updatedAt: now }, { merge: true })
        );

        await batch.commit();
      });
    }

    if (category === 'ooo') {
      await step.run('handle-ooo', async () => {
        // Detect return date from reply text (basic pattern match)
        const returnMatch = replyText.match(/return(?:ing)?\s+(?:on\s+)?([A-Za-z]+\s+\d+)/i);
        const resumeDate = returnMatch
          ? new Date(returnMatch[1] + ' ' + new Date().getFullYear())
          : new Date(Date.now() + 7 * 86_400_000); // default: 7 days

        // Pause queued emails until resume date
        const queued = await adminDb
          .collection('emails')
          .where('leadId', '==', leadId)
          .where('campaignId', '==', campaignId)
          .where('status', '==', 'queued')
          .get();

        const batch = adminDb.batch();
        queued.docs.forEach((d) =>
          batch.set(
            d.ref,
            {
              status: 'queued',
              scheduledAt: resumeDate.toISOString(),
              ooo: true,
              updatedAt: now,
            },
            { merge: true }
          )
        );
        await batch.commit();
      });
    }

    return { emailId, leadId, category, confidence: classification.confidence };
  }
);
