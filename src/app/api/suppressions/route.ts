/**
 * /api/suppressions — manage per-user suppression list.
 *
 * GET    — list all suppressions for the authenticated user
 * POST   — add an email to the suppression list
 * DELETE — remove an email from the suppression list (body: { email })
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, parseJson, requireUser } from "@/lib/api/helpers";
import { createSuppressionSchema } from "@/lib/schemas/lead";
import { z } from "zod";

export const dynamic = "force-dynamic";

const deleteSuppressionSchema = z.object({
  email: z.string().email(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("suppressions.GET", userId);

  try {
    const snap = await adminDb
      .collection("suppressions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const suppressions = snap.docs.map((d) => d.data());
    return NextResponse.json({ data: { suppressions } });
  } catch (err) {
    console.error("[api:suppressions.GET]", err);
    return jsonError("Failed to fetch suppressions", 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createSuppressionSchema);
  if (parsed.response) return parsed.response;
  const { email, reason } = parsed.data;

  logRequest("suppressions.POST", userId, { email, reason });

  try {
    const normalised = email.toLowerCase().trim();
    const id = `sup_${userId}_${Buffer.from(normalised)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 16)}`;

    const existing = await adminDb.collection("suppressions").doc(id).get();
    if (existing.exists) {
      return NextResponse.json({ data: existing.data() }, { status: 200 });
    }

    const now = new Date().toISOString();
    const record = { id, userId, email: normalised, reason, createdAt: now };

    await adminDb.collection("suppressions").doc(id).set(record);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("[api:suppressions.POST]", err);
    return jsonError("Failed to add suppression", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const body = await parseJson<unknown>(req);
  if (!body) return jsonError("Invalid JSON body", 400);
  const parsedBody = deleteSuppressionSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }
  const { email } = parsedBody.data;

  logRequest("suppressions.DELETE", userId, { email });

  try {
    const normalised = email.toLowerCase().trim();
    const snap = await adminDb
      .collection("suppressions")
      .where("userId", "==", userId)
      .where("email", "==", normalised)
      .get();

    if (snap.empty) {
      return jsonError("Suppression not found", 404);
    }

    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({ data: { removed: snap.size } });
  } catch (err) {
    console.error("[api:suppressions.DELETE]", err);
    return jsonError("Failed to remove suppression", 500);
  }
}
