/**
 * /api/dnc — global Do-Not-Contact list (admin-only).
 *
 * GET    — list all DNC entries (admin only)
 * POST   — add an email to the DNC list (admin only)
 * DELETE — remove an email from the DNC list (admin only, body: { email })
 *
 * Admin check: reads `role` from Clerk user's publicMetadata.
 * Returns 403 if the user does not have `role: 'admin'`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, parseJson } from "@/lib/api/helpers";
import { createDncSchema } from "@/lib/schemas/lead";
import { z } from "zod";

export const dynamic = "force-dynamic";

const deleteDncSchema = z.object({
  email: z.string().email(),
});

async function requireAdmin(): Promise<
  { userId: string; response?: undefined } | { userId?: undefined; response: NextResponse }
> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = (sessionClaims?.publicMetadata as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 }) };
  }

  return { userId };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest("dnc.GET", userId);

  try {
    const snap = await adminDb.collection("dnc").orderBy("addedAt", "desc").get();

    const entries = snap.docs.map((d) => d.data());
    return NextResponse.json({ data: { entries } });
  } catch (err) {
    console.error("[api:dnc.GET]", err);
    return jsonError("Failed to fetch DNC list", 500);
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.response) return authResult.response;
  const { userId } = authResult;

  const parsed = await parseAndValidate(req, createDncSchema);
  if (parsed.response) return parsed.response;
  const { email, source } = parsed.data;

  logRequest("dnc.POST", userId, { email, source });

  try {
    const normalised = email.toLowerCase().trim();
    const existing = await adminDb.collection("dnc").doc(normalised).get();
    if (existing.exists) {
      return NextResponse.json({ data: existing.data() }, { status: 200 });
    }

    const now = new Date().toISOString();
    const record = { email: normalised, addedAt: now, source };
    await adminDb.collection("dnc").doc(normalised).set(record);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("[api:dnc.POST]", err);
    return jsonError("Failed to add DNC entry", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.response) return authResult.response;
  const { userId } = authResult;

  const body = await parseJson<unknown>(req);
  if (!body) return jsonError("Invalid JSON body", 400);
  const parsedBody = deleteDncSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }
  const { email } = parsedBody.data;

  logRequest("dnc.DELETE", userId, { email });

  try {
    const normalised = email.toLowerCase().trim();
    const ref = adminDb.collection("dnc").doc(normalised);
    const snap = await ref.get();

    if (!snap.exists) {
      return jsonError("DNC entry not found", 404);
    }

    await ref.delete();
    return NextResponse.json({ data: { removed: normalised } });
  } catch (err) {
    console.error("[api:dnc.DELETE]", err);
    return jsonError("Failed to remove DNC entry", 500);
  }
}
