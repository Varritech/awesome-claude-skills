/**
 * POST /api/webhooks/reply
 *
 * Receives inbound email webhooks from Mailforge.
 * Payload: { messageId, from, subject, body }
 *
 * - Matches by messageId → finds original email record
 * - Sets email status to 'replied', sets lead status to 'replied'
 * - If campaign.replyAction === 'stop', pauses all remaining queued emails
 *   for that lead in that campaign
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseJson } from "@/lib/api/helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const replyWebhookSchema = z.object({
  messageId: z.string().min(1),
  from: z.string().email(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

interface EmailRecord {
  id: string;
  userId: string;
  campaignId?: string;
  leadId?: string;
  status: string;
}

interface CampaignRecord {
  id: string;
  replyAction?: "stop" | "continue";
}

export async function POST(req: NextRequest) {
  const raw = await parseJson<unknown>(req);
  if (!raw) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = replyWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { messageId, from } = parsed.data;

  try {
    // ── 1. Find the original email by messageId ────────────────────────────────
    const emailSnap = await adminDb
      .collection("emails")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();

    if (emailSnap.empty) {
      // Try matching by recipient (from address) as fallback
      const recipientSnap = await adminDb
        .collection("emails")
        .where("recipient", "==", from)
        .where("status", "in", ["sent", "opened"])
        .orderBy("sentAt", "desc")
        .limit(1)
        .get();

      if (recipientSnap.empty) {
        return NextResponse.json({ received: true, matched: false });
      }
      // Use the recipient match
      emailSnap.docs.push(...recipientSnap.docs);
    }

    const emailDoc = emailSnap.docs[0]!;
    const emailData = emailDoc.data() as EmailRecord;
    const now = new Date().toISOString();

    // ── 2. Mark email as replied ──────────────────────────────────────────────
    const batch = adminDb.batch();
    batch.set(emailDoc.ref, { status: "replied", repliedAt: now, updatedAt: now }, { merge: true });

    // ── 3. Mark lead as replied ───────────────────────────────────────────────
    if (emailData.leadId) {
      batch.set(
        adminDb.collection("leads").doc(emailData.leadId),
        { status: "replied", updatedAt: now },
        { merge: true }
      );
    }

    await batch.commit();

    // ── 4. If replyAction='stop', pause all queued emails for this lead ───────
    if (emailData.campaignId && emailData.leadId) {
      const campaignDoc = await adminDb.collection("campaigns").doc(emailData.campaignId).get();
      const campaign = campaignDoc.data() as CampaignRecord | undefined;

      if (campaign?.replyAction === "stop" || !campaign?.replyAction) {
        // Default: stop when replied
        const queuedSnap = await adminDb
          .collection("emails")
          .where("campaignId", "==", emailData.campaignId)
          .where("leadId", "==", emailData.leadId)
          .where("status", "==", "queued")
          .get();

        if (!queuedSnap.empty) {
          const stopBatch = adminDb.batch();
          queuedSnap.docs.forEach((d) => {
            stopBatch.set(d.ref, { status: "paused", updatedAt: now }, { merge: true });
          });
          await stopBatch.commit();
        }
      }
    }

    return NextResponse.json({
      received: true,
      matched: true,
      emailId: emailDoc.id,
      leadId: emailData.leadId,
      campaignId: emailData.campaignId,
    });
  } catch (err) {
    console.error("[api:webhooks.reply] error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
