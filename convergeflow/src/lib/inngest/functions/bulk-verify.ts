/**
 * Inngest function: leads/verify-bulk
 *
 * Accepts { userId, leadIds } and verifies each lead's email in batches of
 * 50. After each batch it fires a `leads/verify-progress` event so the UI
 * can poll for real-time progress.
 *
 * Progress is also written to Firestore at:
 *   verificationProgress/{userId}  →  { done, total, updatedAt }
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { verifyEmail } from "@/lib/verification/verifier";

const BATCH_SIZE = 50;

export const bulkVerifyFn = inngest.createFunction(
  {
    id: "bulk-verify-leads",
    name: "Bulk Verify Leads",
    retries: 1,
    triggers: [{ event: "leads/verify-bulk" }],
  },
  async ({ event, step }) => {
    const { userId, leadIds } = event.data as { userId: string; leadIds: string[] };

    const total = leadIds.length;

    // Initialise progress record
    await step.run("init-progress", async () => {
      await adminDb
        .collection("verificationProgress")
        .doc(userId)
        .set({ done: 0, total, updatedAt: new Date().toISOString() });
    });

    let done = 0;

    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
      const batchIds = leadIds.slice(i, i + BATCH_SIZE);

      await step.run(`verify-batch-${i}`, async () => {
        const now = new Date().toISOString();
        const batch = adminDb.batch();

        await Promise.all(
          batchIds.map(async (leadId) => {
            const ref = adminDb.collection("leads").doc(leadId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const lead = snap.data() as { userId: string; email?: string };
            if (lead.userId !== userId) return;
            if (!lead.email) {
              batch.set(ref, { verified: false, verifiedAt: now, updatedAt: now }, { merge: true });
              return;
            }

            const result = await verifyEmail(lead.email);
            const update: Record<string, unknown> = {
              verified: result.valid,
              verifiedAt: now,
              updatedAt: now,
            };
            if (!result.valid && result.reason) {
              update.verificationReason = result.reason;
            }
            batch.set(ref, update, { merge: true });
          })
        );

        await batch.commit();
      });

      done += batchIds.length;

      // Update progress in Firestore
      await step.run(`update-progress-${i}`, async () => {
        await adminDb
          .collection("verificationProgress")
          .doc(userId)
          .set({ done, total, updatedAt: new Date().toISOString() });
      });

      // Fire progress event
      await step.sendEvent(`progress-event-${i}`, {
        name: "leads/verify-progress",
        data: { userId, done, total },
      });
    }

    return { userId, done, total };
  }
);
