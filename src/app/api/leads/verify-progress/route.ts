/**
 * GET /api/leads/verify-progress
 *
 * Returns the current bulk verification progress for the authenticated user.
 * Data lives in Firestore at verificationProgress/{userId}.
 *
 * Response: { data: { done: number, total: number, updatedAt: string } }
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, requireUser } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("leads.verify-progress.GET", userId);

  try {
    const snap = await adminDb.collection("verificationProgress").doc(userId).get();

    if (!snap.exists) {
      return NextResponse.json({ data: { done: 0, total: 0, updatedAt: null } });
    }

    const data = snap.data() as { done: number; total: number; updatedAt: string };
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api:leads.verify-progress.GET]", err);
    return jsonError("Failed to fetch verification progress", 500);
  }
}
