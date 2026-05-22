/**
 * POST /api/leads/[id]/enrich
 *
 * Merges enrichment data from an external provider into the lead's
 * `enrichment` map in Firestore. The fields are merged at the top level —
 * existing keys are overwritten, new keys are added.
 *
 * Body: { provider: 'apollo'|'aleads'|'snov', fields: Record<string,unknown> }
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { enrichLeadSchema } from "@/lib/schemas/lead";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, enrichLeadSchema);
  if (parsed.response) return parsed.response;
  const { provider, fields } = parsed.data;

  logRequest("leads.[id].enrich.POST", userId, {
    leadId: params.id,
    provider,
    fieldCount: Object.keys(fields).length,
  });

  try {
    const ref = adminDb.collection("leads").doc(params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return jsonError("Lead not found", 404);
    }

    const lead = snap.data() as { userId: string; enrichment?: Record<string, unknown> };
    if (lead.userId !== userId) {
      return jsonError("Forbidden", 403);
    }

    const now = new Date().toISOString();
    const merged: Record<string, unknown> = {
      ...(lead.enrichment ?? {}),
      ...fields,
      _provider: provider,
      _enrichedAt: now,
    };

    await ref.set({ enrichment: merged, updatedAt: now }, { merge: true });

    return NextResponse.json({ data: { id: params.id, provider, enrichment: merged } });
  } catch (err) {
    console.error("[api:leads.[id].enrich.POST]", err);
    return jsonError("Failed to enrich lead", 500);
  }
}
