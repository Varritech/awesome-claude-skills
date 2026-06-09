/**
 * /api/emails - list & create email drafts.
 *
 * GET supports cursor pagination: ?limit=50&cursor=<lastEmailId>.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { createEmailSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

interface EmailRecord {
  id: string;
  userId: string;
  campaignId?: string;
  leadId?: string;
  subject: string;
  body: string;
  persona: 'closer' | 'neighbor' | 'expert' | 'helper';
  status: 'draft' | 'queued' | 'sent' | 'opened' | 'replied' | 'bounced';
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  deletedAt?: string | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
    200,
  );
  const cursor = url.searchParams.get('cursor') ?? undefined;

  logRequest('emails.GET', userId, { limit, cursor });

  try {
    let q = adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    if (cursor) {
      const cursorDoc = await adminDb.collection('emails').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }
    const snap = await q.get();
    const emails = snap.docs
      .map((d) => d.data() as EmailRecord)
      .filter((e) => !e.deletedAt);
    const nextCursor = emails.length === limit ? emails[emails.length - 1]?.id : null;
    return NextResponse.json({ data: emails, nextCursor });
  } catch (err) {
    console.error('[api:emails.GET] firestore error', err);
    return jsonError('Failed to load emails', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createEmailSchema);
  if (parsed.response) return parsed.response;

  const now = new Date().toISOString();
  const id = `em_${Math.random().toString(36).slice(2, 12)}`;
  const record: EmailRecord = {
    id,
    userId,
    campaignId: parsed.data.campaignId,
    leadId: parsed.data.leadId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    persona: parsed.data.persona,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    deletedAt: null,
  };

  logRequest('emails.POST', userId, { id });

  try {
    await adminDb.collection('emails').doc(id).set(record);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error('[api:emails.POST] firestore error', err);
    return jsonError('Failed to create email', 500);
  }
}
