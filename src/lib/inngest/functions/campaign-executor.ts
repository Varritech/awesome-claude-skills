/**
 * Inngest function: campaign/start
 *
 * Loads all leads for a campaign, creates queued email records,
 * and fires email/send events with warmup-aware pacing.
 *
 * campaign/pause — marks all queued emails as paused.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { todayQuota, randomSendDelay } from '@/lib/warmup/scheduler';
import { addSuppression } from '@/lib/suppression/check';

export const campaignStartFn = inngest.createFunction(
  {
    id: 'campaign-start',
    name: 'Start Campaign',
    retries: 2,
    triggers: [{ event: 'campaign/start' }],
  },
  async ({ event, step }) => {
    const { campaignId, userId } = event.data;

    // ── 1. Load campaign ──────────────────────────────────────────────────────
    const campaign = await step.run('load-campaign', async () => {
      const snap = await adminDb.collection('campaigns').doc(campaignId).get();
      if (!snap.exists) throw new Error(`Campaign ${campaignId} not found`);
      const data = snap.data() as CampaignRecord;
      if (data.userId !== userId) throw new Error('Forbidden');
      return data;
    });

    // ── 2. Load inbox for this campaign ───────────────────────────────────────
    const inbox = await step.run('load-inbox', async () => {
      const inboxId = campaign.inboxIds?.[0];
      if (!inboxId) throw new Error('Campaign has no inbox configured');
      const snap = await adminDb.collection('inboxes').doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return { id: inboxId, ...snap.data() } as InboxRecord;
    });

    // ── 3. Load leads not yet contacted ───────────────────────────────────────
    const allLeads = await step.run('load-leads', async () => {
      const snap = await adminDb
        .collection('leads')
        .where('userId', '==', userId)
        .where('status', '==', 'new')
        .limit(campaign.targetLeadCount ?? 500)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadRecord);
    });

    // ── 3b. Apply verification policy ────────────────────────────────────────
    const verificationPolicy = (
      campaign as CampaignRecord & {
        verificationPolicy?: { onInvalid: 'skip' | 'suppress' | 'flag' };
      }
    ).verificationPolicy;
    const leads: LeadRecord[] = [];

    if (verificationPolicy) {
      const now = new Date().toISOString();
      const batch = adminDb.batch();
      let hasBatchOps = false;

      for (const lead of allLeads) {
        const isVerified = (lead as LeadRecord & { verified?: boolean }).verified;

        if (isVerified === false) {
          switch (verificationPolicy.onInvalid) {
            case 'skip':
              // Don't include in leads to contact
              break;
            case 'suppress':
              if (lead.email) {
                await addSuppression(userId, lead.email, 'bounced');
              }
              break;
            case 'flag':
              batch.set(
                adminDb.collection('leads').doc(lead.id),
                { status: 'flagged', updatedAt: now },
                { merge: true },
              );
              hasBatchOps = true;
              break;
          }
          if (verificationPolicy.onInvalid !== 'flag') continue;
        }

        leads.push(lead);
      }

      if (hasBatchOps) {
        await batch.commit();
      }
    } else {
      leads.push(...allLeads);
    }

    if (leads.length === 0) {
      return { skipped: true, reason: 'No new leads to contact' };
    }

    // ── 4. Create queued email records ────────────────────────────────────────
    const quota = todayQuota({
      warmupEnabled: inbox.warmupEnabled,
      warmupStartDate: inbox.warmupStartDate ?? null,
      dailySendLimit: inbox.dailySendLimit,
      status: inbox.status,
    });

    const emailIds: string[] = await step.run('create-email-records', async () => {
      const now = new Date().toISOString();
      const ids: string[] = [];
      const batch = adminDb.batch();

      for (const lead of leads) {
        const id = `em_${Math.random().toString(36).slice(2, 12)}`;
        batch.set(adminDb.collection('emails').doc(id), {
          id,
          userId,
          campaignId,
          leadId: lead.id,
          inboxId: inbox.id,
          subject: campaign.emailSubject ?? 'Quick question',
          body: campaign.emailBody ?? '',
          persona: campaign.persona ?? 'closer',
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          sentAt: null,
        });
        ids.push(id);
      }

      await batch.commit();
      return ids;
    });

    // ── 5. Mark campaign running ──────────────────────────────────────────────
    await step.run('mark-running', async () => {
      await adminDb.collection('campaigns').doc(campaignId).set(
        { status: 'running', updatedAt: new Date().toISOString() },
        { merge: true },
      );
    });

    // ── 6. Fire send events with pacing ───────────────────────────────────────
    const todayBatch = emailIds.slice(0, quota);

    await step.sendEvent(
      'queue-sends',
      todayBatch.map((emailId, i) => ({
        name: 'email/send' as const,
        data: { emailId, inboxId: inbox.id, userId },
        ts: Date.now() + randomSendDelay(8) + i * 5_000,
      })),
    );

    return {
      campaignId,
      leadsEnqueued: leads.length,
      sendingToday: todayBatch.length,
      dailyQuota: quota,
    };
  },
);

export const campaignPauseFn = inngest.createFunction(
  {
    id: 'campaign-pause',
    name: 'Pause Campaign',
    retries: 2,
    triggers: [{ event: 'campaign/pause' }],
  },
  async ({ event, step }) => {
    const { campaignId } = event.data;

    await step.run('pause-queued-emails', async () => {
      const snap = await adminDb
        .collection('emails')
        .where('campaignId', '==', campaignId)
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

    await step.run('mark-paused', async () => {
      await adminDb.collection('campaigns').doc(campaignId).set(
        { status: 'paused', updatedAt: new Date().toISOString() },
        { merge: true },
      );
    });

    return { campaignId, paused: true };
  },
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignRecord {
  id: string;
  userId: string;
  inboxIds?: string[];
  targetLeadCount?: number;
  persona?: string;
  emailSubject?: string;
  emailBody?: string;
  status: string;
}

interface InboxRecord {
  id: string;
  email: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
}

interface LeadRecord {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}
