/**
 * POST /api/campaigns/[id]/start
 * Fires the campaign/start Inngest event.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, requireUser } from "@/lib/api/helpers";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: campaignId } = ctx.params;

  logRequest("campaigns.[id].start.POST", userId, { campaignId });

  try {
    const doc = await adminDb.collection("campaigns").doc(campaignId).get();
    if (!doc.exists) return jsonError("Campaign not found", 404);
    const data = doc.data() as { userId?: string; status?: string };
    if (data.userId && data.userId !== userId) return jsonError("Forbidden", 403);
    if (data.status === "running") return jsonError("Campaign is already running", 409);

    await inngest.send({ name: "campaign/start", data: { campaignId, userId } });
    return NextResponse.json({ data: { started: true, campaignId } });
  } catch (err) {
    console.error("[api:campaigns.[id].start.POST]", err);
    return jsonError("Failed to start campaign", 500);
  }
}
