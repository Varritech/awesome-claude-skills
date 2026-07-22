/**
 * GET  /api/campaigns/[id]/leads — list the leads attached to this campaign.
 * POST /api/campaigns/[id]/leads — attach leads to this campaign (sets
 *   `campaignId` on each lead). Body: { leadIds: string[] }.
 *
 * Leads are associated with a campaign via `lead.campaignId`; `sequence-tick`
 * queries by that field to send the campaign's sequence to its leads.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { jsonError, logRequest, parseAndValidate, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

const attachLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(1_000),
});

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: campaignId } = ctx.params;

  logRequest('campaigns.[id].leads.GET', userId, { campaignId });

  try {
    // Verify the campaign belongs to the user before listing its leads.
    const campaignSnap = await adminDb.collection('campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return jsonError('Campaign not found', 404);
    const campaign = campaignSnap.data() as { userId?: string };
    if (campaign.userId && campaign.userId !== userId) return jsonError('Forbidden', 403);

    const snap = await adminDb
      .collection('leads')
      .where('campaignId', '==', campaignId)
      .get();
    const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ data: leads });
  } catch (err) {
    console.error('[api:campaigns.[id].leads.GET] error', err);
    return jsonError('Failed to load campaign leads', 500);
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: campaignId } = ctx.params;

  const parsed = await parseAndValidate(req, attachLeadsSchema);
  if (parsed.response) return parsed.response;
  const { leadIds } = parsed.data;

  logRequest('campaigns.[id].leads.POST', userId, { campaignId, count: leadIds.length });

  try {
    // Verify campaign ownership.
    const campaignSnap = await adminDb.collection('campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return jsonError('Campaign not found', 404);
    const campaign = campaignSnap.data() as { userId?: string };
    if (campaign.userId && campaign.userId !== userId) return jsonError('Forbidden', 403);

    const now = new Date().toISOString();
    let attached = 0;
    const batch = adminDb.batch();

    for (const leadId of leadIds) {
      const ref = adminDb.collection('leads').doc(leadId);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const lead = snap.data() as { userId?: string };
      // Only attach leads owned by this user.
      if (lead.userId && lead.userId !== userId) continue;
      batch.set(ref, { campaignId, updatedAt: now }, { merge: true });
      attached++;
    }

    if (attached > 0) await batch.commit();
    return NextResponse.json({ data: { attached } }, { status: 201 });
  } catch (err) {
    console.error('[api:campaigns.[id].leads.POST] error', err);
    return jsonError('Failed to attach leads', 500);
  }
}