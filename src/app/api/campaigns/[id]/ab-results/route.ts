/**
 * GET /api/campaigns/[id]/ab-results
 *
 * Returns per-variant breakdown for A/B testing:
 * { label, sent, opened, replied } for each variant.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, requireUser } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

interface EmailRecord {
  id: string;
  abVariant?: string;
  status: string;
}

interface VariantResult {
  label: string;
  sent: number;
  opened: number;
  replied: number;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: campaignId } = ctx.params;

  logRequest("campaigns.[id].ab-results.GET", userId, { campaignId });

  try {
    // Verify campaign ownership
    const campaignDoc = await adminDb.collection("campaigns").doc(campaignId).get();
    if (!campaignDoc.exists) return jsonError("Campaign not found", 404);
    const campaignData = campaignDoc.data() as {
      userId?: string;
      abVariants?: Array<{ label: string }>;
    };
    if (campaignData.userId && campaignData.userId !== userId) return jsonError("Forbidden", 403);

    // Fetch all emails for this campaign that have an abVariant assigned
    const emailsSnap = await adminDb
      .collection("emails")
      .where("campaignId", "==", campaignId)
      .where("status", "in", ["sent", "opened", "replied", "bounced"])
      .get();

    const emails = emailsSnap.docs.map((d) => d.data() as EmailRecord);

    // Group by variant
    const variantMap = new Map<string, VariantResult>();

    // Pre-seed with defined variants so even 0-send variants appear
    const definedVariants = campaignData.abVariants ?? [];
    for (const v of definedVariants) {
      variantMap.set(v.label, { label: v.label, sent: 0, opened: 0, replied: 0 });
    }

    for (const email of emails) {
      const label = email.abVariant ?? "default";
      if (!variantMap.has(label)) {
        variantMap.set(label, { label, sent: 0, opened: 0, replied: 0 });
      }
      const entry = variantMap.get(label)!;
      if (["sent", "opened", "replied"].includes(email.status)) entry.sent++;
      if (email.status === "opened" || email.status === "replied") entry.opened++;
      if (email.status === "replied") entry.replied++;
    }

    const results = Array.from(variantMap.values());

    return NextResponse.json({ data: results });
  } catch (err) {
    console.error("[api:campaigns.[id].ab-results.GET] error", err);
    return jsonError("Failed to fetch A/B results");
  }
}
