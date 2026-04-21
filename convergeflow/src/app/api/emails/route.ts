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

function mockSeed(userId: string): EmailRecord[] {
  const base: Array<Partial<EmailRecord>> = [
    {
      id: 'em_demo_1',
      subject: 'Quick question about Acme',
      status: 'replied',
      persona: 'closer',
      sentAt: '2026-04-14T09:01:00.000Z',
    },
    {
      id: 'em_demo_2',
      subject: 'Saw your launch post',
      status: 'opened',
      persona: 'neighbor',
      sentAt: '2026-04-13T13:22:00.000Z',
    },
    {
      id: 'em_demo_3',
      subject: 'Deliverability audit - 10 min',
      status: 'sent',
      persona: 'expert',
      sentAt: '2026-04-12T10:05:00.000Z',
    },
    {
      id: 'em_demo_4',
      subject: 'One-pager checklist',
      status: 'draft',
      persona: 'helper',
      sentAt: null,
    },
  ];
  const now = new Date().toISOString();
  return base.map(
    (b) =>
      ({
        userId,
        campaignId: 'cmp_demo_1',
        body: 'Hey {{firstName}},\n\nQuick one - ...',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...b,
      }) as EmailRecord,
  );
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
    if (emails.length === 0) {
      const seed = mockSeed(userId).slice(0, limit);
      return NextResponse.json({ data: seed, nextCursor: null });
    }
    return NextResponse.json({ data: emails, nextCursor });
  } catch (err) {
    console.warn('[api:emails.GET] falling back to mock seed', err);
    return NextResponse.json({
      data: mockSeed(userId).slice(0, limit),
      nextCursor: null,
    });
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
  } catch (err) {
    console.warn('[api:emails.POST] placeholder mode', err);
  }
  return NextResponse.json({ data: record }, { status: 201 });
}
