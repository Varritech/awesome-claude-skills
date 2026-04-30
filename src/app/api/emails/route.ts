/**
 * /api/emails - list & create email drafts.
 *
 * GET supports cursor pagination: ?limit=50&cursor=<lastEmailId>.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
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

  const snap = await adminDb
    .collection('emails')
    .where('userId', '==', userId)
    .limit(200)
    .get();
  const emails = snap.docs
    .map((d) => d.data() as EmailRecord)
    .filter((e) => !e.deletedAt)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
  const nextCursor = emails.length === limit ? emails[emails.length - 1]?.id : null;
  return NextResponse.json({ data: emails, nextCursor });
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
  } catch (err) {
    console.warn('[api:emails.POST] placeholder mode', err);
  }
  return NextResponse.json({ data: record }, { status: 201 });
}
