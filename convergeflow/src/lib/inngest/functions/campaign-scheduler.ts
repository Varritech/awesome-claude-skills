/**
 * Inngest function: campaign-scheduler
 *
 * Runs every 15 minutes via cron. Finds campaigns with status='scheduled'
 * and scheduledAt <= now, then fires campaign/start for each.
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";

interface CampaignRecord {
  id: string;
  userId: string;
  status: string;
  scheduledAt?: string | null;
}

export const campaignSchedulerFn = inngest.createFunction(
  {
    id: "campaign-scheduler",
    name: "Campaign Scheduler",
    retries: 1,
    triggers: [
      { cron: "*/15 * * * *" },
      { event: "scheduler/run" }, // allow on-demand trigger for testing
    ],
  },
  async ({ step }) => {
    // ── 1. Find all campaigns due to start ────────────────────────────────────
    const dueCampaigns = await step.run("find-due-campaigns", async () => {
      const now = new Date().toISOString();
      const snap = await adminDb
        .collection("campaigns")
        .where("status", "==", "scheduled")
        .where("scheduledAt", "<=", now)
        .get();

      return snap.docs.map((d) => {
        const data = d.data() as CampaignRecord;
        return { id: d.id, userId: data.userId };
      });
    });

    if (dueCampaigns.length === 0) {
      return { started: 0 };
    }

    // ── 2. Fire campaign/start for each ───────────────────────────────────────
    await step.sendEvent(
      "start-due-campaigns",
      dueCampaigns.map((c) => ({
        name: "campaign/start" as const,
        data: { campaignId: c.id, userId: c.userId },
      }))
    );

    // ── 3. Mark campaigns as 'running' so they don't get picked up again ──────
    await step.run("mark-starting", async () => {
      const batch = adminDb.batch();
      const now = new Date().toISOString();
      for (const c of dueCampaigns) {
        batch.set(
          adminDb.collection("campaigns").doc(c.id),
          { status: "running", updatedAt: now },
          { merge: true }
        );
      }
      await batch.commit();
    });

    return { started: dueCampaigns.length };
  }
);
