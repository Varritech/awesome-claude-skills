/**
 * GET/POST/DELETE /api/leads/[id]/tags
 *
 * GET  — returns current tags array
 * POST — adds tags (union, no duplicates)
 * DELETE — removes tags
 *
 * Tags are stored as a Firestore array field on the lead document.
 */

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { updateLeadTagsSchema } from "@/lib/schemas/lead";

export const dynamic = "force-dynamic";

async function resolveLeadForUser(leadId: string, userId: string) {
  const ref = adminDb.collection("leads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) return { ref: null, snap: null, lead: null };
  const lead = snap.data() as { userId: string; tags?: string[] };
  if (lead.userId !== userId) return { ref: null, snap: null, lead: null, forbidden: true };
  return { ref, snap, lead, forbidden: false };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("leads.[id].tags.GET", userId, { leadId: params.id });

  try {
    const { lead, forbidden } = await resolveLeadForUser(params.id, userId);
    if (forbidden) return jsonError("Forbidden", 403);
    if (!lead) return jsonError("Lead not found", 404);

    return NextResponse.json({ data: { tags: lead.tags ?? [] } });
  } catch (err) {
    console.error("[api:leads.[id].tags.GET]", err);
    return jsonError("Failed to get tags", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateLeadTagsSchema);
  if (parsed.response) return parsed.response;
  const { tags } = parsed.data;

  logRequest("leads.[id].tags.POST", userId, { leadId: params.id, tags });

  try {
    const { ref, lead, forbidden } = await resolveLeadForUser(params.id, userId);
    if (forbidden) return jsonError("Forbidden", 403);
    if (!ref || !lead) return jsonError("Lead not found", 404);

    const now = new Date().toISOString();
    await ref.set(
      {
        tags: FieldValue.arrayUnion(...tags),
        updatedAt: now,
      },
      { merge: true }
    );

    // Re-fetch to return actual state
    const updated = await ref.get();
    const updatedTags = (updated.data() as { tags?: string[] }).tags ?? [];

    return NextResponse.json({ data: { tags: updatedTags } });
  } catch (err) {
    console.error("[api:leads.[id].tags.POST]", err);
    return jsonError("Failed to add tags", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateLeadTagsSchema);
  if (parsed.response) return parsed.response;
  const { tags } = parsed.data;

  logRequest("leads.[id].tags.DELETE", userId, { leadId: params.id, tags });

  try {
    const { ref, lead, forbidden } = await resolveLeadForUser(params.id, userId);
    if (forbidden) return jsonError("Forbidden", 403);
    if (!ref || !lead) return jsonError("Lead not found", 404);

    const now = new Date().toISOString();
    await ref.set(
      {
        tags: FieldValue.arrayRemove(...tags),
        updatedAt: now,
      },
      { merge: true }
    );

    const updated = await ref.get();
    const updatedTags = (updated.data() as { tags?: string[] }).tags ?? [];

    return NextResponse.json({ data: { tags: updatedTags } });
  } catch (err) {
    console.error("[api:leads.[id].tags.DELETE]", err);
    return jsonError("Failed to remove tags", 500);
  }
}
