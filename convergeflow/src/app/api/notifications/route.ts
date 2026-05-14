/**
 * GET /api/notifications
 *
 * Returns the last 10 unread (and recently read) notifications for the user.
 * Notifications live in Firestore under `notifications/{id}`.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, jsonError, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface Notification {
  id: string;
  type: "reply" | "bounce" | "booking";
  message: string;
  leadName: string;
  campaignName: string;
  createdAt: string;
  read: boolean;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("notifications.GET", userId);

  try {
    const snap = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const data: Notification[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Notification, "id">),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api:notifications.GET]", err);
    return jsonError("Failed to fetch notifications", 500);
  }
}
