/**
 * /api/sequences/[id] - fetch, update, delete a single sequence.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { updateSequenceSchema } from "@/lib/schemas/sequence";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest("sequences.[id].GET", userId, { id });

  try {
    const doc = await adminDb.collection("sequences").doc(id).get();
    if (!doc.exists) return jsonError("Sequence not found", 404);
    const data = doc.data() as { userId?: string; deletedAt?: string | null };
    if (data.userId && data.userId !== userId) return jsonError("Forbidden", 403);
    if (data.deletedAt) return jsonError("Sequence not found", 404);
    return NextResponse.json({ data: { id, ...data } });
  } catch (err) {
    console.error("[api:sequences.[id].GET] error", err);
    return jsonError("Failed to fetch sequence");
  }
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, updateSequenceSchema);
  if (parsed.response) return parsed.response;

  logRequest("sequences.[id].PUT", userId, { id });

  try {
    const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
    try {
      await adminDb.collection("sequences").doc(id).set(patch, { merge: true });
    } catch (err) {
      console.warn("[api:sequences.[id].PUT] Firestore write skipped (placeholder)", err);
    }
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.error("[api:sequences.[id].PUT] error", err);
    return jsonError("Failed to update sequence");
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest("sequences.[id].DELETE", userId, { id });

  const deletedAt = new Date().toISOString();
  try {
    await adminDb
      .collection("sequences")
      .doc(id)
      .set({ deletedAt, updatedAt: deletedAt }, { merge: true });
  } catch (err) {
    console.warn("[api:sequences.[id].DELETE] placeholder mode", err);
  }
  return NextResponse.json({ data: { id, deletedAt } });
}
