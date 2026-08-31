/**
 * GET /api/help/articles/[slug]
 *
 * Returns a single article by slug.
 */

import { NextResponse } from "next/server";
import { getArticleBySlug } from "@/lib/help/articles";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const article = getArticleBySlug(params.slug);
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ article });
}
