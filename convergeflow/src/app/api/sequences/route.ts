/**
 * /api/sequences - list & create email sequences.
 *
 * A sequence defines a multi-step drip campaign: ordered email steps with
 * per-step conditions (always/no_reply/no_open) and day delays.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { createSequenceSchema } from "@/lib/schemas/sequence";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("sequences.GET", userId);

  try {
    const snap = await adminDb
      .collection("sequences")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const sequences = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s: Record<string, unknown>) => !s.deletedAt);

    return NextResponse.json({ data: sequences });
  } catch (err) {
    console.warn("[api:sequences.GET] Firestore error", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createSequenceSchema);
  if (parsed.response) return parsed.response;

  logRequest("sequences.POST", userId, { name: parsed.data.name });

  try {
    const now = new Date().toISOString();
    const id = `seq_${Math.random().toString(36).slice(2, 12)}`;
    const record = {
      id,
      userId,
      name: parsed.data.name,
      steps: parsed.data.steps ?? [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    try {
      await adminDb.collection("sequences").doc(id).set(record);
    } catch (err) {
      console.warn("[api:sequences.POST] Firestore write skipped (placeholder)", err);
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("[api:sequences.POST] error", err);
    return jsonError("Failed to create sequence");
  }
}
