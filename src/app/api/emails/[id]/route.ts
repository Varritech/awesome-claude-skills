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
    console.error('[api:emails.[id].GET] firestore error', err);
    return jsonError('Failed to load email', 500);
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
    const doc = await adminDb.collection('emails').doc(id).get();
    if (!doc.exists) return jsonError('Email not found', 404);
    const raw = doc.data() as EmailRecord;
    if (raw.userId && raw.userId !== userId) return jsonError('Forbidden', 403);
    await adminDb.collection('emails').doc(id).set(patch, { merge: true });
    return NextResponse.json({ data: { id, ...patch } });
  } catch (err) {
    console.error('[api:emails.[id].PATCH] firestore error', err);
    return jsonError('Failed to update email', 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const deletedAt = new Date().toISOString();
  logRequest('emails.[id].DELETE', userId, { id });

  try {
    const doc = await adminDb.collection('emails').doc(id).get();
    if (!doc.exists) return jsonError('Email not found', 404);
    const raw = doc.data() as EmailRecord;
    if (raw.userId && raw.userId !== userId) return jsonError('Forbidden', 403);
    await adminDb
      .collection('emails')
      .doc(id)
      .set({ deletedAt, updatedAt: deletedAt }, { merge: true });
    return NextResponse.json({ data: { id, deletedAt } });
  } catch (err) {
    console.error('[api:emails.[id].DELETE] firestore error', err);
    return jsonError('Failed to delete email', 500);
  }
}
