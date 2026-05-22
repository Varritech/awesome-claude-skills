/**
 * PATCH /api/notifications/[id]
 *
 * Marks a notification as read.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, jsonError, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: { id: string };
}

export async function PATCH(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest("notifications.[id].PATCH", userId, { id });

  try {
    const notifSnap = await adminDb.collection("notifications").doc(id).get();
    if (!notifSnap.exists) return jsonError("Notification not found", 404);
    if (notifSnap.data()?.userId !== userId) return jsonError("Forbidden", 403);

    await adminDb
      .collection("notifications")
      .doc(id)
      .set({ read: true, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ data: { id, read: true } });
  } catch (err) {
    console.error("[api:notifications.[id].PATCH]", err);
    return jsonError("Failed to mark notification as read", 500);
  }
}
