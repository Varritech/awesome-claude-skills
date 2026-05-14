/**
 * GET /api/replies
 *
 * Returns all emails with status 'replied', joined with lead + campaign info.
 * Supports optional ?category= filter for client-side filtering.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, jsonError, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;

  logRequest("replies.GET", userId, { category });

  try {
    // Fetch all replied emails for this user
    const query = adminDb
      .collection("emails")
      .where("userId", "==", userId)
      .where("status", "==", "replied")
      .orderBy("repliedAt", "desc")
      .limit(200);

    const emailsSnap = await query.get();
    const emails = emailsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Filter by category if provided
    const filtered = category
      ? emails.filter((e: Record<string, unknown>) => e.replyCategory === category)
      : emails;

    // Collect unique lead and campaign IDs for batch fetch
    const leadIds = [
      ...new Set(filtered.map((e: Record<string, unknown>) => e.leadId).filter(Boolean)),
    ] as string[];
    const campaignIds = [
      ...new Set(filtered.map((e: Record<string, unknown>) => e.campaignId).filter(Boolean)),
    ] as string[];

    // Batch fetch leads
    const leadsMap: Record<string, Record<string, unknown>> = {};
    if (leadIds.length > 0) {
      const chunks = chunkArray(leadIds, 10);
      for (const chunk of chunks) {
        const snaps = await Promise.all(
          chunk.map((id) => adminDb.collection("leads").doc(id).get())
        );
        for (const snap of snaps) {
          if (snap.exists)
            leadsMap[snap.id] = { id: snap.id, ...snap.data() } as Record<string, unknown>;
        }
      }
    }

    // Batch fetch campaigns
    const campaignsMap: Record<string, Record<string, unknown>> = {};
    if (campaignIds.length > 0) {
      const chunks = chunkArray(campaignIds, 10);
      for (const chunk of chunks) {
        const snaps = await Promise.all(
          chunk.map((id) => adminDb.collection("campaigns").doc(id).get())
        );
        for (const snap of snaps) {
          if (snap.exists)
            campaignsMap[snap.id] = { id: snap.id, ...snap.data() } as Record<string, unknown>;
        }
      }
    }

    // Join data
    const data = filtered.map((email: Record<string, unknown>) => ({
      ...email,
      lead: email.leadId ? (leadsMap[email.leadId as string] ?? null) : null,
      campaign: email.campaignId ? (campaignsMap[email.campaignId as string] ?? null) : null,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api:replies.GET]", err);
    return jsonError("Failed to fetch replies", 500);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
