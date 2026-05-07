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

const PERSONA_LABELS: Record<string, string> = {
  closer: 'Direct Closer',
  neighbor: 'Friendly Neighbor',
  expert: 'Expert Advisor',
  helper: 'Helpful Guide',
};

type CampaignStatus = 'active' | 'warming' | 'paused' | 'done' | 'draft';
type EmailItemStatus = 'replied' | 'opened' | 'sent' | 'bounced';

function emailStatusToCampaign(status: EmailRecord['status']): CampaignStatus {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'queued':
    case 'sent':
    case 'opened':
      return 'active';
    case 'replied':
      return 'done';
    case 'bounced':
      return 'paused';
    default:
      return 'draft';
  }
}

function emailStatusToItemStatus(status: EmailRecord['status']): EmailItemStatus {
  if (status === 'replied') return 'replied';
  if (status === 'opened') return 'opened';
  if (status === 'bounced') return 'bounced';
  return 'sent';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toEmailCampaignDetail(record: EmailRecord) {
  const hasSent = !!record.sentAt;
  const isReplied = record.status === 'replied';
  const isOpened = record.status === 'opened' || isReplied;

  return {
    id: record.id,
    name: record.subject || 'Untitled',
    style: PERSONA_LABELS[record.persona] ?? record.persona,
    status: emailStatusToCampaign(record.status),
    startedAt: record.sentAt ? formatDate(record.sentAt) : undefined,
    sent: hasSent ? 1 : 0,
    total: 1,
    replied: isReplied ? 1 : 0,
    interested: isReplied ? 1 : 0,
    openRate: isOpened ? '100%' : '0%',
    emails: [
      {
        id: record.id,
        recipient: record.leadId || 'Test Recipient',
        company: '',
        subject: record.subject,
        status: emailStatusToItemStatus(record.status),
        lastActivity: record.sentAt ? formatDate(record.sentAt) : 'Draft',
        preview: record.body.slice(0, 80),
      },
    ],
  };
}

function mockEmail(userId: string, id: string) {
  const record: EmailRecord = {
    id,
    userId,
    campaignId: 'cmp_demo_1',
    leadId: 'ld_demo_1',
    subject: 'Quick question about Acme',
    body:
      'Hey Alex,\n\nQuick one - we just helped 3 SaaS teams book 20+ calls in 30 days without hiring.\n\nWorth a 15-min chat Thursday?\n\n- Chris',
    persona: 'closer',
    status: 'sent',
    createdAt: '2026-04-14T09:00:00.000Z',
    updatedAt: '2026-04-14T09:01:00.000Z',
    sentAt: '2026-04-14T09:01:00.000Z',
    deletedAt: null,
  };
  return toEmailCampaignDetail(record);
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
    const raw = doc.data() as EmailRecord;
    if (raw.userId && raw.userId !== userId) {
      return jsonError('Forbidden', 403);
    }
    return NextResponse.json({ data: toEmailCampaignDetail(raw) });
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
