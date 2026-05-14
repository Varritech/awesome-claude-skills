/**
 * POST /api/feedback
 *
 * Saves user feedback to the `feedback` Firestore collection.
 * Auth is optional — feedback from unauthenticated users is still captured.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, parseAndValidate } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "general"]),
  message: z.string().min(1).max(5000),
  url: z.string().optional().default(""),
  userAgent: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  const { data, response } = await parseAndValidate(req, feedbackSchema);
  if (response) return response;

  // userId is best-effort — not required for feedback
  let userId: string | null = null;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const result = await auth();
    userId = result.userId ?? null;
  } catch {
    // Ignore auth errors — anonymous feedback is fine
  }

  try {
    const doc = adminDb.collection("feedback").doc();
    const record = {
      id: doc.id,
      userId: userId ?? "anonymous",
      type: data.type,
      message: data.message,
      url: data.url,
      userAgent: data.userAgent,
      createdAt: new Date().toISOString(),
    };
    await doc.set(record);
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (err) {
    console.error("[api:feedback] save failed", err);
    return jsonError("Failed to save feedback", 500);
  }
}
