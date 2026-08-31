/**
 * POST /api/emails/[id]/send
 *
 * Test-send a queued email to a specific address (testRecipient).
 * Fires an Inngest email/send event with testRecipient override.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  testRecipient: z.string().email().optional(),
});

interface RouteCtx {
  params: { id: string };
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: emailId } = ctx.params;

  const parsed = await parseAndValidate(req, sendSchema);
  if (parsed.response) return parsed.response;
  const { testRecipient } = parsed.data;

  logRequest("emails.[id].send.POST", userId, { emailId, testRecipient });

  // Verify ownership
  try {
    const doc = await adminDb.collection("emails").doc(emailId).get();
    if (!doc.exists) return jsonError("Email not found", 404);
    const data = doc.data() as { userId?: string; inboxId?: string };
    if (data.userId && data.userId !== userId) return jsonError("Forbidden", 403);

    const inboxId = data.inboxId;
    if (!inboxId) return jsonError("Email has no inbox assigned", 422);

    await inngest.send({
      name: "email/send",
      data: { emailId, inboxId, userId, ...(testRecipient ? { testRecipient } : {}) },
    });

    return NextResponse.json({
      data: { queued: true, emailId, testRecipient: testRecipient ?? null },
    });
  } catch (err) {
    console.error("[api:emails.[id].send.POST]", err);
    return jsonError("Failed to queue send", 500);
  }
}
