/**
 * Inngest function: campaign/start
 *
 * Loads all leads for a campaign, creates queued email records,
 * and fires email/send events with warmup-aware pacing.
 *
 * campaign/pause — marks all queued emails as paused.
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { todayQuota, randomSendDelay } from "@/lib/warmup/scheduler";

export const campaignStartFn = inngest.createFunction(
  {
    id: "campaign-start",
    name: "Start Campaign",
    retries: 2,
    triggers: [{ event: "campaign/start" }],
  },
  async ({ event, step }) => {
    const { campaignId, userId } = event.data;

    // ── 1. Load campaign ──────────────────────────────────────────────────────
    const campaign = await step.run("load-campaign", async () => {
      const snap = await adminDb.collection("campaigns").doc(campaignId).get();
      if (!snap.exists) throw new Error(`Campaign ${campaignId} not found`);
      const data = snap.data() as CampaignRecord;
      if (data.userId !== userId) throw new Error("Forbidden");
      return data;
    });

    // ── 2. Load inbox for this campaign (round-robin rotation) ────────────────
    const inbox = await step.run("load-inbox", async () => {
      const inboxIds = campaign.inboxIds ?? [];
      if (inboxIds.length === 0) throw new Error("Campaign has no inbox configured");
      const campaignRef = adminDb.collection("campaigns").doc(campaignId);
      const emailIndex: number = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(campaignRef);
        const current = (snap.data()?.emailIndex ?? 0) as number;
        tx.set(campaignRef, { emailIndex: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
        return current;
      });
      const inboxId = inboxIds[emailIndex % inboxIds.length]!;
      const snap = await adminDb.collection("inboxes").doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return { id: inboxId, ...snap.data() } as InboxRecord;
    });

    // ── 3. Load leads not yet contacted ───────────────────────────────────────
    const leads = await step.run("load-leads", async () => {
      const snap = await adminDb
        .collection("leads")
        .where("userId", "==", userId)
        .where("status", "==", "new")
        .limit(campaign.targetLeadCount ?? 500)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadRecord);
    });

    if (leads.length === 0) {
      return { skipped: true, reason: "No new leads to contact" };
    }

    // ── 4. Create queued email records ────────────────────────────────────────
    const quota = todayQuota({
      warmupEnabled: inbox.warmupEnabled,
      warmupStartDate: inbox.warmupStartDate ?? null,
      dailySendLimit: inbox.dailySendLimit,
      status: inbox.status,
    });

    const emailIds: string[] = await step.run("create-email-records", async () => {
      const now = new Date().toISOString();
      const ids: string[] = [];
      const batch = adminDb.batch();

      for (const lead of leads) {
        const id = `em_${Math.random().toString(36).slice(2, 12)}`;
        batch.set(adminDb.collection("emails").doc(id), {
          id,
          userId,
          campaignId,
          leadId: lead.id,
          inboxId: inbox.id,
          subject: campaign.emailSubject ?? "Quick question",
          body: campaign.emailBody ?? "",
          persona: campaign.persona ?? "closer",
          status: "queued",
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
    await step.run("mark-running", async () => {
      await adminDb
        .collection("campaigns")
        .doc(campaignId)
        .set({ status: "running", updatedAt: new Date().toISOString() }, { merge: true });
    });

    // ── 6. Fire send events with pacing ───────────────────────────────────────
    const todayBatch = emailIds.slice(0, quota);

    await step.sendEvent(
      "queue-sends",
      todayBatch.map((emailId, i) => ({
        name: "email/send" as const,
        data: { emailId, inboxId: inbox.id, userId },
        ts: Date.now() + randomSendDelay(8) + i * 5_000,
      }))
    );

    return {
      campaignId,
      leadsEnqueued: leads.length,
      sendingToday: todayBatch.length,
      dailyQuota: quota,
    };
  }
);

export const campaignPauseFn = inngest.createFunction(
  {
    id: "campaign-pause",
    name: "Pause Campaign",
    retries: 2,
    triggers: [{ event: "campaign/pause" }],
  },
  async ({ event, step }) => {
    const { campaignId } = event.data;

    await step.run("pause-queued-emails", async () => {
      const snap = await adminDb
        .collection("emails")
        .where("campaignId", "==", campaignId)
        .where("status", "==", "queued")
        .get();

      const batch = adminDb.batch();
      const now = new Date().toISOString();
      snap.docs.forEach((d) => {
        batch.set(d.ref, { status: "paused", updatedAt: now }, { merge: true });
      });
      await batch.commit();
      return snap.size;
    });

    await step.run("mark-paused", async () => {
      await adminDb
        .collection("campaigns")
        .doc(campaignId)
        .set({ status: "paused", updatedAt: new Date().toISOString() }, { merge: true });
    });

    return { campaignId, paused: true };
  }
);

// ─── Sequence helpers ─────────────────────────────────────────────────────────

interface SequenceStep {
  delayDays: number;
  subject: string;
  body: string;
}

/**
 * Bug 3 fix: first step with delayDays > 0 must NOT fire immediately.
 * If lastSentAt is null (campaign just started), only allow send when delayDays === 0.
 */
export function isStepDue(step: SequenceStep, lastSentAt: string | null): boolean {
  if (!lastSentAt) return step.delayDays === 0;
  const last = new Date(lastSentAt).getTime();
  const now = Date.now();
  return now - last >= step.delayDays * 86_400_000;
}

/**
 * Bug 4 fix: errors must NOT silently stop the sequence.
 * Default to false (keep sending) and log the error.
 */
export async function shouldStopSequence(leadId: string, campaignId: string): Promise<boolean> {
  try {
    const snap = await adminDb
      .collection("leadSequenceState")
      .doc(`${leadId}_${campaignId}`)
      .get();
    const data = snap.data();
    if (!data) return false;
    return data.replied === true || data.unsubscribed === true || data.bounced === true;
  } catch (err) {
    console.error('[shouldStopSequence] error, defaulting to false', err);
    return false;
  }
}

/**
 * Bug 2 fix: atomic daily send counter using a Firestore transaction.
 */
export async function incrementDailySend(userId: string, inboxId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.collection('dailySendCounters').doc(`${userId}_${inboxId}_${today}`);
    const doc = await tx.get(ref);
    const current = (doc.data()?.count ?? 0) as number;
    tx.set(ref, { count: current + 1, updatedAt: new Date().toISOString() }, { merge: true });
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignRecord {
  id: string;
  userId: string;
  inboxIds?: string[];
  emailIndex?: number;
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
