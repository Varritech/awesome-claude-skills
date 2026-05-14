/**
 * GET /api/emails/queue
 *
 * Returns all queued and paused emails for the authenticated user,
 * enriched with lead and campaign names for the Queue UI.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, requireUser } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

interface RawEmail {
  id: string;
  userId: string;
  campaignId?: string;
  leadId?: string;
  subject: string;
  status: "queued" | "paused";
  scheduledAt?: string | null;
  inboxId?: string;
}

interface QueuedEmail extends RawEmail {
  leadName: string;
  leadEmail?: string;
  campaignName: string;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("emails.queue.GET", userId);

  try {
    const snap = await adminDb
      .collection("emails")
      .where("userId", "==", userId)
      .where("status", "in", ["queued", "paused"])
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const rawEmails = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RawEmail[];

    // Collect unique campaignIds and leadIds for batch lookups
    const campaignIds = Array.from(
      new Set(rawEmails.map((e) => e.campaignId).filter(Boolean) as string[])
    );
    const leadIds = Array.from(new Set(rawEmails.map((e) => e.leadId).filter(Boolean) as string[]));

    // Batch-fetch campaigns
    const campaignMap = new Map<string, string>();
    for (const cid of campaignIds) {
      try {
        const doc = await adminDb.collection("campaigns").doc(cid).get();
        if (doc.exists) {
          const data = doc.data() as { name?: string };
          campaignMap.set(cid, data.name ?? cid);
        }
      } catch {
        campaignMap.set(cid, cid);
      }
    }

    // Batch-fetch leads
    const leadMap = new Map<string, { name: string; email?: string }>();
    for (const lid of leadIds) {
      try {
        const doc = await adminDb.collection("leads").doc(lid).get();
        if (doc.exists) {
          const data = doc.data() as { firstName?: string; lastName?: string; email?: string };
          const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || lid;
          leadMap.set(lid, { name, email: data.email });
        }
      } catch {
        leadMap.set(lid, { name: lid });
      }
    }

    const enriched: QueuedEmail[] = rawEmails.map((email) => ({
      ...email,
      leadName: email.leadId ? (leadMap.get(email.leadId)?.name ?? "Unknown") : "Unknown",
      leadEmail: email.leadId ? leadMap.get(email.leadId)?.email : undefined,
      campaignName: email.campaignId ? (campaignMap.get(email.campaignId) ?? email.campaignId) : "",
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.warn("[api:emails.queue.GET] Firestore error", err);
    return jsonError("Failed to fetch email queue");
  }
}
