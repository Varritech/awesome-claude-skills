/**
 * /api/campaigns/[id] - fetch, update, soft-delete a single campaign.
 *
 * Ownership is enforced in code by comparing `data.userId` to the caller's
 * `userId`. Firestore security rules should mirror this. No mock fallbacks:
 * missing docs return 404, Firestore errors return 500.
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

    const emailsSnap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .where('campaignId', '==', id)
      .get();
    const emails = emailsSnap.docs.map((d) => d.data());

    return NextResponse.json({ data: { ...data, emails } });
  } catch (err) {
    console.error('[api:campaigns.[id].GET] firestore error', err);
    return jsonError('Failed to load campaign', 500);
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
    const existing = await adminDb.collection('campaigns').doc(id).get();
    if (!existing.exists) return jsonError('Campaign not found', 404);
    const existingData = existing.data() as { userId?: string };
    if (existingData.userId && existingData.userId !== userId) return jsonError('Forbidden', 403);
    const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
    await adminDb.collection('campaigns').doc(id).set(patch, { merge: true });
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.error('[api:campaigns.[id].PATCH] firestore error', err);
    return jsonError('Failed to update campaign', 500);
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
    const existing = await adminDb.collection('campaigns').doc(id).get();
    if (!existing.exists) return jsonError('Campaign not found', 404);
    const existingData = existing.data() as { userId?: string };
    if (existingData.userId && existingData.userId !== userId) return jsonError('Forbidden', 403);
    await adminDb
      .collection('campaigns')
      .doc(id)
      .set({ deletedAt, updatedAt: deletedAt }, { merge: true });
    return NextResponse.json({ data: { id, deletedAt } });
  } catch (err) {
    console.error('[api:campaigns.[id].DELETE] firestore error', err);
    return jsonError('Failed to delete campaign', 500);
  }
}
