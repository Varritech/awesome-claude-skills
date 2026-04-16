/**
 * /api/emails/[id] - get, update, soft-delete a single email.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { updateEmailSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

function mockEmail(userId: string, id: string) {
  return {
    id,
    userId,
    campaignId: 'cmp_demo_1',
    leadId: 'ld_demo_1',
    subject: 'Quick question about Acme',
    body:
      'Hey Alex,\n\nQuick one - we just helped 3 SaaS teams book 20+ calls in 30 days without hiring.\n\nWorth a 15-min chat Thursday?\n\n- Chris',
    persona: 'closer' as const,
    status: 'sent' as const,
    createdAt: '2026-04-14T09:00:00.000Z',
    updatedAt: '2026-04-14T09:01:00.000Z',
    sentAt: '2026-04-14T09:01:00.000Z',
    deletedAt: null,
  };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest('emails.[id].GET', userId, { id });

  try {
    const doc = await adminDb.collection('emails').doc(id).get();
    if (!doc.exists) return jsonError('Email not found', 404);
    const data = doc.data() as { userId?: string };
    if (data.userId && data.userId !== userId) {
      return jsonError('Forbidden', 403);
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.warn('[api:emails.[id].GET] falling back to mock', err);
    return NextResponse.json({ data: mockEmail(userId, id) });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, updateEmailSchema);
  if (parsed.response) return parsed.response;

  const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
  logRequest('emails.[id].PATCH', userId, { id, patch });

  try {
    await adminDb.collection('emails').doc(id).set(patch, { merge: true });
  } catch (err) {
    console.warn('[api:emails.[id].PATCH] placeholder mode', err);
  }
  return NextResponse.json({ data: { id, ...patch } });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const deletedAt = new Date().toISOString();
  logRequest('emails.[id].DELETE', userId, { id });

  try {
    await adminDb
      .collection('emails')
      .doc(id)
      .set({ deletedAt, updatedAt: deletedAt }, { merge: true });
  } catch (err) {
    console.warn('[api:emails.[id].DELETE] placeholder mode', err);
  }
  return NextResponse.json({ data: { id, deletedAt } });
}
