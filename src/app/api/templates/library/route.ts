/**
 * GET /api/templates/library
 *
 * Returns 10 built-in email templates (hardcoded, persona-tagged).
 * 2 templates per persona (closer/neighbor/expert/helper) + 2 bonus.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, logRequest } from "@/lib/api/helpers";
import { LIBRARY_TEMPLATES } from "@/lib/emails/library-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const { searchParams } = new URL(req.url);
  const persona = searchParams.get("persona") ?? undefined;

  logRequest("templates.library.GET", userId, { persona });

  const data = persona ? LIBRARY_TEMPLATES.filter((t) => t.persona === persona) : LIBRARY_TEMPLATES;

  return NextResponse.json({ data });
}
