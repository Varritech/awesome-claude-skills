/**
 * PATCH /api/leads/[id]/status
 *
 * Updates the status of a single lead. Valid transitions are enforced by
 * the leadStatusSchema. A `statusUpdatedAt` timestamp is written alongside
 * the status change for audit purposes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { updateLeadStatusSchema } from "@/lib/schemas/lead";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateLeadStatusSchema);
  if (parsed.response) return parsed.response;
  const { status } = parsed.data;

  logRequest("leads.[id].status.PATCH", userId, { leadId: params.id, status });

  try {
    const ref = adminDb.collection("leads").doc(params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return jsonError("Lead not found", 404);
    }

    const lead = snap.data() as { userId: string };
    if (lead.userId !== userId) {
      return jsonError("Forbidden", 403);
    }

    const now = new Date().toISOString();
    await ref.set({ status, statusUpdatedAt: now, updatedAt: now }, { merge: true });

    return NextResponse.json({ data: { id: params.id, status, updatedAt: now } });
  } catch (err) {
    console.error("[api:leads.[id].status.PATCH]", err);
    return jsonError("Failed to update lead status", 500);
  }
}
