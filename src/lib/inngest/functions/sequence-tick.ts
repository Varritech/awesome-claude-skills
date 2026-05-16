/**
 * Inngest function: sequence/tick
 *
 * Fires daily (via cron) for each running campaign that has a sequence.
 * For each lead, checks whether the next sequence step's condition is met
 * and fires email/send if so.
 *
 * Trigger: "sequence/tick" event (fired by the daily cron or on-demand).
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { shouldSendNextStep } from "./sending-logic";
import type { StepCondition } from "./sending-logic";

interface SequenceStep {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
  condition: StepCondition;
}

interface CampaignRecord {
  id: string;
  userId: string;
  sequenceId: string;
  inboxIds: string[];
  status: string;
  emailIndex: number;
}

interface SequenceRecord {
  id: string;
  userId: string;
  steps: SequenceStep[];
}

interface LeadRecord {
  id: string;
  userId: string;
  status: string;
}

interface EmailRecord {
  id: string;
  campaignId: string;
  leadId: string;
  sequenceStep: number;
  status: string;
  sentAt?: string | null;
}

export const sequenceTickFn = inngest.createFunction(
  {
    id: "sequence-tick",
    name: "Sequence Step Tick",
    retries: 2,
    triggers: [{ event: "sequence/tick" }],
  },
  async ({ event, step }) => {
    const { campaignId, userId } = event.data as { campaignId: string; userId: string };

    // ── 1. Load campaign ──────────────────────────────────────────────────────
    const campaign = await step.run("load-campaign", async () => {
      const snap = await adminDb.collection("campaigns").doc(campaignId).get();
      if (!snap.exists) throw new Error(`Campaign ${campaignId} not found`);
      const data = snap.data() as CampaignRecord;
      if (data.userId !== userId) throw new Error("Forbidden");
      if (data.status !== "running") throw new Error(`Campaign status is ${data.status}`);
      if (!data.sequenceId) throw new Error("Campaign has no sequence attached");
      return data;
    });

    // ── 2. Load sequence ──────────────────────────────────────────────────────
    const sequence = await step.run("load-sequence", async () => {
      const snap = await adminDb.collection("sequences").doc(campaign.sequenceId).get();
      if (!snap.exists) throw new Error(`Sequence ${campaign.sequenceId} not found`);
      return { id: campaign.sequenceId, ...snap.data() } as SequenceRecord;
    });

    if (!sequence.steps || sequence.steps.length === 0) {
      return { skipped: true, reason: "Sequence has no steps" };
    }

    const sortedSteps = [...sequence.steps].sort((a, b) => a.order - b.order);

    // ── 3. Load all leads for this campaign ───────────────────────────────────
    const leads = await step.run("load-leads", async () => {
      const snap = await adminDb
        .collection("leads")
        .where("userId", "==", userId)
        .where("status", "in", ["contacted", "opened"])
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadRecord);
    });

    if (leads.length === 0) {
      return { skipped: true, reason: "No eligible leads" };
    }

    // ── 4. For each lead, determine which step they're on and if next is due ──
    const eventsToFire: Array<{
      name: "email/send";
      data: { emailId: string; inboxId: string; userId: string };
      ts: number;
    }> = [];

    const now = new Date();

    for (const lead of leads) {
      await step.run(`check-lead-${lead.id}`, async () => {
        // Find the last email sent to this lead in this campaign
        const emailSnap = await adminDb
          .collection("emails")
          .where("campaignId", "==", campaignId)
          .where("leadId", "==", lead.id)
          .where("status", "in", ["sent", "opened", "replied"])
          .orderBy("sequenceStep", "desc")
          .limit(1)
          .get();

        let lastStepIndex = -1;
        let lastSentAt: Date | null = null;

        if (!emailSnap.empty) {
          const lastEmail = emailSnap.docs[0]!.data() as EmailRecord;
          lastStepIndex = lastEmail.sequenceStep ?? 0;
          lastSentAt = lastEmail.sentAt ? new Date(lastEmail.sentAt) : null;
        }

        const nextStepIndex = lastStepIndex + 1;
        const nextStep = sortedSteps[nextStepIndex];
        if (!nextStep) return; // No more steps

        const lastStepSentDaysAgo = lastSentAt
          ? Math.floor((now.getTime() - lastSentAt.getTime()) / 86_400_000)
          : 0;

        const condition = nextStep.condition ?? {
          type: "always" as const,
          afterDays: nextStep.delayDays,
        };

        const shouldSend = shouldSendNextStep({
          condition,
          step: nextStep,
          leadStatus: lead.status,
          lastStepSentDaysAgo,
        });

        if (!shouldSend) return;

        // Create the email record for this step
        const emailId = `em_${Math.random().toString(36).slice(2, 12)}`;
        const inboxId = campaign.inboxIds?.[0] ?? "";
        if (!inboxId) return;

        const emailNow = new Date().toISOString();
        await adminDb.collection("emails").doc(emailId).set({
          id: emailId,
          userId,
          campaignId,
          leadId: lead.id,
          inboxId,
          subject: nextStep.subject,
          body: nextStep.body,
          sequenceStep: nextStepIndex,
          status: "queued",
          createdAt: emailNow,
          updatedAt: emailNow,
          sentAt: null,
        });

        eventsToFire.push({
          name: "email/send",
          data: { emailId, inboxId, userId },
          ts: Date.now() + nextStepIndex * 2_000,
        });
      });
    }

    if (eventsToFire.length > 0) {
      await step.sendEvent("fire-sequence-sends", eventsToFire);
    }

    return {
      campaignId,
      leadsChecked: leads.length,
      emailsQueued: eventsToFire.length,
    };
  }
);
