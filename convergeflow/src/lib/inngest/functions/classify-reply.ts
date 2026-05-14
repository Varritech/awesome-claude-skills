/**
 * Inngest function: reply/received
 *
 * Triggered when an incoming reply is detected.
 * Runs AI classification, updates the email record with replyCategory,
 * and fires lead status updates for do_not_contact / booked categories.
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { classifyReplyWithAI } from "@/lib/replies/ai-classifier";
import { ollamaClient } from "@/lib/ollama/client";

export const classifyReplyFn = inngest.createFunction(
  {
    id: "classify-reply",
    name: "Classify Reply",
    retries: 2,
    triggers: [{ event: "reply/received" }],
  },
  async ({ event, step }) => {
    const { emailId, replyBody, leadId } = event.data;

    // ── 1. Classify the reply ────────────────────────────────────────────────
    const category = await step.run("classify", async () => {
      return classifyReplyWithAI(replyBody, ollamaClient);
    });

    // ── 2. Update email record with replyCategory ────────────────────────────
    await step.run("update-email", async () => {
      await adminDb.collection("emails").doc(emailId).set(
        {
          replyCategory: category,
          status: "replied",
          repliedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    // ── 3. Update lead status for actionable categories ───────────────────────
    if (leadId && (category === "do_not_contact" || category === "booked")) {
      await step.run("update-lead-status", async () => {
        const newStatus = category === "booked" ? "booked" : "unsubscribed";
        await adminDb.collection("leads").doc(leadId).set(
          {
            status: newStatus,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
    }

    return { emailId, category, leadId };
  }
);
