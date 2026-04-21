/**
 * /api/campaigns/[id] - fetch, update, soft-delete a single campaign.
 *
 * TODO: Enforce ownership on every read/write via Firestore rules too.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { updateCampaignSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

function mockCampaign(userId: string, id: string) {
  return {
    id,
    userId,
    name: 'Q2 SaaS founders',
    description: '50 B2B SaaS founders in NYC',
    status: 'running' as const,
    persona: 'closer' as const,
    targetLeadCount: 50,
    sentCount: 42,
    repliedCount: 7,
    bookedCount: 3,
    createdAt: '2026-03-28T14:12:00.000Z',
    updatedAt: '2026-04-14T09:02:00.000Z',
    deletedAt: null,
    emails: [
      {
        id: 'em_demo_1',
        subject: 'Quick question about {{company}}',
        status: 'sent',
        sentAt: '2026-04-14T09:01:00.000Z',
      },
      {
        id: 'em_demo_2',
        subject: 'Following up',
        status: 'queued',
        sentAt: null,
      },
    ],
  };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest('campaigns.[id].GET', userId, { id });

  try {
    const doc = await adminDb.collection('campaigns').doc(id).get();
    if (!doc.exists) {
      return jsonError('Campaign not found', 404);
    }
    const data = doc.data() as { userId?: string };
    if (data.userId && data.userId !== userId) {
      return jsonError('Forbidden', 403);
    }
    // TODO: join email list from `emails` collection filtered by campaignId.
    return NextResponse.json({ data: { ...data, emails: [] } });
  } catch (err) {
    console.warn('[api:campaigns.[id].GET] falling back to mock', err);
    return NextResponse.json({ data: mockCampaign(userId, id) });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, updateCampaignSchema);
  if (parsed.response) return parsed.response;

  logRequest('campaigns.[id].PATCH', userId, { id, patch: parsed.data });

  try {
    const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
    await adminDb.collection('campaigns').doc(id).set(patch, { merge: true });
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.warn('[api:campaigns.[id].PATCH] placeholder mode', err);
    return NextResponse.json({
      data: { id, ...parsed.data, updatedAt: new Date().toISOString() },
    });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest('campaigns.[id].DELETE', userId, { id });

  const deletedAt = new Date().toISOString();
  try {
    await adminDb
      .collection('campaigns')
      .doc(id)
      .set({ deletedAt, updatedAt: deletedAt }, { merge: true });
  } catch (err) {
    console.warn('[api:campaigns.[id].DELETE] placeholder mode', err);
  }
  return NextResponse.json({ data: { id, deletedAt } });
}
