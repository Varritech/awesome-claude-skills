/**
 * Inngest function: campaign/generate-sequences
 *
 * Bulk generates AI sequences for all new leads in a campaign.
 * Stores generated emails in Firestore, ready for campaign-executor to send.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { generateSequence } from '@/lib/ai/sequence-generator';
import type { ProspectContext, CampaignContext } from '@/lib/ai/personalization';

export const generateSequencesFn = inngest.createFunction(
  {
    id: 'generate-sequences',
    name: 'Generate AI Email Sequences',
    retries: 2,
    triggers: [{ event: 'campaign/generate-sequences' }],
    // Rate limit: 1 campaign at a time per user to control GLM usage
    concurrency: { limit: 3, key: 'event.data.userId' },
  },
  async ({ event, step }) => {
    const { campaignId, userId } = event.data as { campaignId: string; userId: string };

    // ── 1. Load campaign ──────────────────────────────────────────────────────
    const campaign = await step.run('load-campaign', async () => {
      const snap = await adminDb.collection('campaigns').doc(campaignId).get();
      if (!snap.exists) throw new Error(`Campaign ${campaignId} not found`);
      return snap.data() as {
        name: string;
        niche?: string;
        offer?: string;
        senderName?: string;
        persona?: string;
        inboxIds?: string[];
        targetLeadCount?: number;
      };
    });

    const campaignCtx: CampaignContext = {
      senderName: campaign.senderName ?? 'Jake',
      businessName: campaign.name,
      niche: campaign.niche ?? campaign.persona ?? 'business',
      offer: campaign.offer ?? 'outbound email system',
    };

    // ── 2. Load new leads ─────────────────────────────────────────────────────
    const leads = await step.run('load-leads', async () => {
      const snap = await adminDb
        .collection('leads')
        .where('userId', '==', userId)
        .where('status', '==', 'new')
        .limit(campaign.targetLeadCount ?? 200)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (ProspectContext & { id: string })[];
    });

    if (leads.length === 0) {
      return { skipped: true, reason: 'No new leads' };
    }

    // ── 3. Generate + store sequences ─────────────────────────────────────────
    let generated = 0;
    const inboxId = campaign.inboxIds?.[0] ?? null;
    const now = new Date().toISOString();

    // Process leads in batches of 10 to respect rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      await step.run(`generate-batch-${i}`, async () => {
        const sequences = await Promise.all(
          batch.map((lead) => {
            const prospect: ProspectContext = {
              firstName: lead.firstName,
              lastName: lead.lastName,
              company: lead.company,
              city: lead.city,
              industry: lead.industry,
            };
            return generateSequence(prospect, campaignCtx).then((seq) => ({
              leadId: lead.id,
              seq,
            }));
          })
        );

        const firestoreBatch = adminDb.batch();
        for (const { leadId, seq } of sequences) {
          // Store A-variant as primary, B-variants tagged for A/B tracking
          for (const email of seq.emails) {
            const emailId = `em_${Math.random().toString(36).slice(2, 12)}`;
            const sendAt = new Date();
            sendAt.setDate(sendAt.getDate() + email.dayOffset);

            firestoreBatch.set(adminDb.collection('emails').doc(emailId), {
              id: emailId,
              userId,
              campaignId,
              leadId,
              inboxId,
              subject: email.subject,
              body: email.body,
              persona: campaignCtx.niche,
              emailNumber: email.emailNumber,
              variant: email.variant,
              plainText: true,
              status: email.variant === 'A' ? 'queued' : 'ab_variant',
              scheduledAt: sendAt.toISOString(),
              createdAt: now,
              updatedAt: now,
              sentAt: null,
            });
          }
          generated++;
        }
        await firestoreBatch.commit();
      });
    }

    // ── 4. Mark campaign as sequences-ready ───────────────────────────────────
    await step.run('mark-ready', async () => {
      await adminDb.collection('campaigns').doc(campaignId).set(
        { sequencesGenerated: true, sequencesGeneratedAt: now, updatedAt: now },
        { merge: true }
      );
    });

    return { campaignId, leadsProcessed: leads.length, sequencesGenerated: generated };
  }
);
