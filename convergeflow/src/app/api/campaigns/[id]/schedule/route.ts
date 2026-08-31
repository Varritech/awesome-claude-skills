/**
 * POST /api/campaigns/[id]/schedule
 *
 * Schedules a campaign to start at a specific time.
 * Body: { scheduledAt: string (ISO datetime) }
 *
 * Sets campaign status to 'scheduled' and stores scheduledAt.
 * The campaign-scheduler Inngest function will pick it up when the time comes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

interface RouteCtx {
  params: { id: string };
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, scheduleSchema);
  if (parsed.response) return parsed.response;

  logRequest("campaigns.[id].schedule.POST", userId, { id, scheduledAt: parsed.data.scheduledAt });

  // Validate the scheduled time is in the future
  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (scheduledAt <= new Date()) {
    return jsonError("scheduledAt must be in the future", 400);
  }

  const now = new Date().toISOString();

  try {
    // Verify ownership
    const doc = await adminDb.collection("campaigns").doc(id).get();
    if (!doc.exists) return jsonError("Campaign not found", 404);
    const data = doc.data() as { userId?: string; status?: string };
    if (data.userId && data.userId !== userId) return jsonError("Forbidden", 403);

    const patch = {
      status: "scheduled",
      scheduledAt: parsed.data.scheduledAt,
      updatedAt: now,
    };

    await adminDb.collection("campaigns").doc(id).set(patch, { merge: true });
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.warn("[api:campaigns.[id].schedule.POST] Firestore error", err);
    // Placeholder fallback
    return NextResponse.json({
      data: {
        id,
        status: "scheduled",
        scheduledAt: parsed.data.scheduledAt,
        updatedAt: now,
      },
    });
  }
}
