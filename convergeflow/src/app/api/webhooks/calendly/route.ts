/**
 * POST /api/webhooks/calendly
 *
 * Receives Calendly booking webhooks (invitee.created).
 * Matches the invitee's email to a lead, marks lead as 'booked',
 * updates email replyCategory, and creates a notification.
 */

import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CalendlyWebhookPayload {
  event: string;
  payload: {
    email: string;
    name: string;
    event_type?: { name?: string };
    event?: { uri?: string; start_time?: string };
  };
}

export async function POST(req: NextRequest) {
  let body: CalendlyWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (body.event !== "invitee.created") {
    // Acknowledge but ignore other event types
    return NextResponse.json({ received: true });
  }

  const { email: inviteeEmail, name: inviteeName } = body.payload;

  if (!inviteeEmail) {
    return jsonError("Missing invitee email in payload", 400);
  }

  try {
    // Find lead by email (across all users — Calendly doesn't send userId)
    const leadsSnap = await adminDb
      .collection("leads")
      .where("email", "==", inviteeEmail)
      .limit(1)
      .get();

    if (leadsSnap.empty) {
      // No matching lead — still acknowledge webhook
      return NextResponse.json({ received: true, matched: false });
    }

    const leadDoc = leadsSnap.docs[0];
    const lead = { id: leadDoc.id, ...leadDoc.data() } as Record<string, unknown>;
    const userId = lead.userId as string;

    const now = new Date().toISOString();

    // Mark lead as booked
    await adminDb
      .collection("leads")
      .doc(leadDoc.id)
      .set({ status: "booked", updatedAt: now }, { merge: true });

    // Update most recent email for this lead to replyCategory: 'booked'
    const emailsSnap = await adminDb
      .collection("emails")
      .where("leadId", "==", leadDoc.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let campaignName = "";
    if (!emailsSnap.empty) {
      const emailDoc = emailsSnap.docs[0];
      const emailData = emailDoc.data() as Record<string, unknown>;

      await adminDb
        .collection("emails")
        .doc(emailDoc.id)
        .set(
          { replyCategory: "booked", status: "replied", repliedAt: now, updatedAt: now },
          { merge: true }
        );

      // Fetch campaign name for notification
      if (emailData.campaignId) {
        const campSnap = await adminDb
          .collection("campaigns")
          .doc(emailData.campaignId as string)
          .get();
        if (campSnap.exists)
          campaignName = ((campSnap.data() as Record<string, unknown>).name as string) ?? "";
      }
    }

    // Create notification
    const notifRef = adminDb.collection("notifications").doc();
    await notifRef.set({
      userId,
      type: "booking",
      message: `${inviteeName} booked a meeting.`,
      leadName: inviteeName,
      campaignName,
      read: false,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ received: true, matched: true, leadId: leadDoc.id });
  } catch (err) {
    console.error("[api:webhooks.calendly.POST]", err);
    return jsonError("Internal error processing webhook", 500);
  }
}
