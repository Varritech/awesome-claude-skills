/**
 * POST /api/campaigns/[id]/generate-sequence
 *
 * Generates a full AI-powered 5-email Straight Line sequence for all leads
 * in a campaign. Stores generated emails in Firestore. Returns sequence preview.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { jsonError, logRequest, requireUser } from '@/lib/api/helpers';
import { generateSequence } from '@/lib/ai/sequence-generator';
import type { ProspectContext, CampaignContext } from '@/lib/ai/personalization';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id: campaignId } = ctx.params;

  logRequest('campaigns.[id].generate-sequence.POST', userId, { campaignId });

  // Load campaign
  const campaignSnap = await adminDb.collection('campaigns').doc(campaignId).get();
  if (!campaignSnap.exists) return jsonError('Campaign not found', 404);

  const campaign = campaignSnap.data() as {
    userId: string;
    name: string;
    emailSubject?: string;
    emailBody?: string;
    persona?: string;
    niche?: string;
    offer?: string;
    senderName?: string;
    inboxIds?: string[];
  };

  if (campaign.userId !== userId) return jsonError('Forbidden', 403);

  // Parse optional body for overrides
  let body: { prospectId?: string; regenerate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const campaignCtx: CampaignContext = {
    senderName: campaign.senderName ?? 'Jake',
    businessName: campaign.name,
    niche: campaign.niche ?? campaign.persona ?? 'business',
    offer: campaign.offer ?? 'outbound email system',
  };

  // If a single prospectId is given, generate just for that prospect (preview mode)
  if (body.prospectId) {
    const leadSnap = await adminDb.collection('leads').doc(body.prospectId).get();
    if (!leadSnap.exists) return jsonError('Lead not found', 404);

    const lead = leadSnap.data() as ProspectContext & { id: string };
    const prospect: ProspectContext = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      city: lead.city,
      industry: lead.industry,
    };

    try {
      const sequence = await generateSequence(prospect, campaignCtx);
      return NextResponse.json({ data: sequence });
    } catch (err) {
      console.error('[generate-sequence] generation failed', err);
      return jsonError('AI generation failed', 500);
    }
  }

  // Bulk mode: generate for all new leads in the campaign, queue via Inngest
  const { inngest } = await import('@/lib/inngest/client');
  await inngest.send({
    name: 'campaign/generate-sequences',
    data: { campaignId, userId },
  });

  return NextResponse.json({
    data: { queued: true, campaignId, message: 'Sequence generation started' },
  });
}
