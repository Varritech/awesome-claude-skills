/**
 * Inngest function: bounce-monitor
 *
 * Triggered by email/bounced events.
 * Calculates bounce rate for the campaign; if > 10%, fires campaign/pause.
 *
 * Threshold: bounced / (sent + bounced) > 10%
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { calculateBounceRate } from "./sending-logic";

const BOUNCE_THRESHOLD_PCT = 10;

export const bounceMonitorFn = inngest.createFunction(
  {
    id: "bounce-monitor",
    name: "Bounce Monitor",
    retries: 2,
    triggers: [{ event: "email/bounced" }],
  },
  async ({ event, step }) => {
    const { emailId, campaignId, userId, reason } = event.data as {
      emailId: string;
      campaignId: string;
      userId: string;
      reason?: string;
    };

    if (!campaignId) {
      return { skipped: true, reason: "No campaignId on bounce event" };
    }

    // ── 1. Mark the email as bounced ──────────────────────────────────────────
    await step.run("mark-email-bounced", async () => {
      const now = new Date().toISOString();
      await adminDb
        .collection("emails")
        .doc(emailId)
        .set(
          {
            status: "bounced",
            bounceReason: reason ?? "unknown",
            updatedAt: now,
          },
          { merge: true }
        );
    });

    // ── 2. Mark lead as bounced ───────────────────────────────────────────────
    await step.run("mark-lead-bounced", async () => {
      const snap = await adminDb.collection("emails").doc(emailId).get();
      const emailData = snap.data() as { leadId?: string } | undefined;
      if (!emailData?.leadId) return;
      await adminDb
        .collection("leads")
        .doc(emailData.leadId)
        .set({ status: "bounced", updatedAt: new Date().toISOString() }, { merge: true });
    });

    // ── 3. Count sent and bounced emails for this campaign ────────────────────
    const stats = await step.run("count-campaign-bounces", async () => {
      const [sentSnap, bouncedSnap] = await Promise.all([
        adminDb
          .collection("emails")
          .where("campaignId", "==", campaignId)
          .where("status", "==", "sent")
          .get(),
        adminDb
          .collection("emails")
          .where("campaignId", "==", campaignId)
          .where("status", "==", "bounced")
          .get(),
      ]);
      return { sent: sentSnap.size, bounced: bouncedSnap.size };
    });

    const bounceRate = calculateBounceRate(stats);

    // ── 4. Auto-pause if threshold exceeded ───────────────────────────────────
    if (bounceRate > BOUNCE_THRESHOLD_PCT) {
      await step.sendEvent("auto-pause-campaign", {
        name: "campaign/pause" as const,
        data: { campaignId, userId },
      });

      await step.run("mark-campaign-high-bounce", async () => {
        await adminDb
          .collection("campaigns")
          .doc(campaignId)
          .set(
            {
              bounceFlagged: true,
              bounceRate: Math.round(bounceRate * 100) / 100,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      });

      return {
        campaignId,
        bounceRate,
        autoPaused: true,
        stats,
      };
    }

    return { campaignId, bounceRate, autoPaused: false, stats };
  }
);
