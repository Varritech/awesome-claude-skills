/**
 * PATCH /api/inboxes/[id]
 *
 * Mid-warmup "skip warmup" action: flips a connecting/warming inbox straight
 * to `active` with warmup disabled, so the user can send to real customers
 * immediately without waiting for the 14-day ramp.
 *
 * Body: { skipWarmup: true }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { jsonError, logRequest, parseAndValidate, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

const patchInboxSchema = z.object({
  skipWarmup: z.boolean(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, patchInboxSchema);
  if (parsed.response) return parsed.response;

  logRequest('inboxes.[id].PATCH', userId, { id, skipWarmup: parsed.data.skipWarmup });

  if (!parsed.data.skipWarmup) {
    return jsonError('Only skipWarmup=true is supported', 400);
  }

  try {
    const existing = await adminDb.collection('inboxes').doc(id).get();
    if (!existing.exists) return jsonError('Inbox not found', 404);
    const existingData = existing.data() as { userId?: string; warmupStartDate?: string | null };
    if (existingData.userId && existingData.userId !== userId) {
      return jsonError('Forbidden', 403);
    }

    const now = new Date().toISOString();
    const patch = {
      status: 'active',
      warmupEnabled: false,
      warmupSkipped: true,
      warmupStartDate: existingData.warmupStartDate ?? now,
      updatedAt: now,
    };
    await adminDb.collection('inboxes').doc(id).set(patch, { merge: true });
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.error('[api:inboxes.[id].PATCH] firestore error', err);
    return jsonError('Failed to update inbox', 500);
  }
}