/**
 * GET /api/help/articles
 *
 * Returns all articles, optionally filtered by ?q= search query.
 */

import { NextResponse, type NextRequest } from "next/server";
import { searchArticles } from "@/lib/help/articles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = searchArticles(q);
  return NextResponse.json({ articles: results });
}
