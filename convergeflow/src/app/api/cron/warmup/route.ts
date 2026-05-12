/**
 * GET /api/cron/warmup
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Queries all inboxes in connecting/warming status and fires
 * inbox/warmup-tick events for each one.
 *
 * Secured by CRON_SECRET header (set in Vercel env).
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection("inboxes")
      .where("warmupEnabled", "==", true)
      .where("status", "in", ["connecting", "warming"])
      .get();

    if (snap.empty) {
      return NextResponse.json({ data: { fired: 0 } });
    }

    const events = snap.docs.map((doc) => {
      const data = doc.data() as { userId: string };
      return {
        name: "inbox/warmup-tick" as const,
        data: { inboxId: doc.id, userId: data.userId },
      };
    });

    await inngest.send(events);

    console.info(`[cron:warmup] fired ${events.length} warmup-tick events`);
    return NextResponse.json({ data: { fired: events.length } });
  } catch (err) {
    console.error("[cron:warmup]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
