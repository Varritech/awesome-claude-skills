/**
 * POST /api/leads/[id]/verify
 *
 * Triggers email verification for a single lead. Runs the DNS MX check,
 * then writes `verified` and `verifiedAt` to Firestore.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, requireUser } from "@/lib/api/helpers";
import { verifyEmail } from "@/lib/verification/verifier";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("leads.[id].verify.POST", userId, { leadId: params.id });

  try {
    const ref = adminDb.collection("leads").doc(params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return jsonError("Lead not found", 404);
    }

    const lead = snap.data() as { userId: string; email?: string };
    if (lead.userId !== userId) {
      return jsonError("Forbidden", 403);
    }

    if (!lead.email) {
      return jsonError("Lead has no email address to verify", 422);
    }

    const result = await verifyEmail(lead.email);
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      verified: result.valid,
      verifiedAt: now,
      updatedAt: now,
    };

    if (!result.valid && result.reason) {
      update.verificationReason = result.reason;
    }

    await ref.set(update, { merge: true });

    return NextResponse.json({
      data: {
        id: params.id,
        email: lead.email,
        verified: result.valid,
        verifiedAt: now,
        reason: result.valid ? undefined : result.reason,
      },
    });
  } catch (err) {
    console.error("[api:leads.[id].verify.POST]", err);
    return jsonError("Failed to verify lead", 500);
  }
}
