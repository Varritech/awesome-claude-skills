/**
 * /api/campaigns/[id]/routing — get & update routing rules for a campaign.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import {
  requireUser,
  parseAndValidate,
  logRequest,
  jsonError,
  handleError,
} from '@/lib/api/helpers';
import { assertOwnership } from '@/lib/security/data-isolation';

export const dynamic = 'force-dynamic';

const routingRuleSchema = z.object({
  condition: z.enum(['industry', 'location', 'always']),
  value: z.string().default(''),
  domainId: z.string().min(1),
});

const updateRoutingSchema = z.object({
  rules: z.array(routingRuleSchema),
});

interface CampaignRecord {
  id: string;
  userId: string;
  [key: string]: unknown;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('campaigns.[id].routing.GET', userId);

  try {
    const snap = await adminDb.collection('campaigns').doc(params.id).get();
    if (!snap.exists) return jsonError('Campaign not found', 404);
    const campaign = snap.data() as CampaignRecord;
    assertOwnership(userId, campaign, 'campaign');
    const routingRules = (campaign.routingRules as { rules: unknown[] } | undefined) ?? { rules: [] };
    return NextResponse.json({ data: routingRules });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateRoutingSchema);
  if (parsed.response) return parsed.response;

  logRequest('campaigns.[id].routing.PUT', userId);

  try {
    const snap = await adminDb.collection('campaigns').doc(params.id).get();
    if (!snap.exists) return jsonError('Campaign not found', 404);
    const campaign = snap.data() as CampaignRecord;
    assertOwnership(userId, campaign, 'campaign');

    const routingRules = { rules: parsed.data.rules };
    await adminDb
      .collection('campaigns')
      .doc(params.id)
      .set({ routingRules, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ data: routingRules });
  } catch (err) {
    return handleError(err);
  }
}
