/**
 * /api/campaigns - list & create campaigns.
 *
 * TODO: Replace mock seed data with real Firestore reads once the Firebase
 * admin credentials are configured. All reads are scoped by `userId`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { createCampaignSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

interface CampaignRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'archived';
  persona: 'closer' | 'neighbor' | 'expert' | 'helper';
  targetLeadCount?: number;
  sentCount: number;
  repliedCount: number;
  bookedCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function mockSeed(userId: string): CampaignRecord[] {
  return [
    {
      id: 'cmp_demo_1',
      userId,
      name: 'Q2 SaaS founders',
      description: '50 B2B SaaS founders in NYC',
      status: 'running',
      persona: 'closer',
      targetLeadCount: 50,
      sentCount: 42,
      repliedCount: 7,
      bookedCount: 3,
      createdAt: '2026-03-28T14:12:00.000Z',
      updatedAt: '2026-04-14T09:02:00.000Z',
      deletedAt: null,
    },
    {
      id: 'cmp_demo_2',
      userId,
      name: 'Local dentists - Texas',
      status: 'draft',
      persona: 'neighbor',
      targetLeadCount: 120,
      sentCount: 0,
      repliedCount: 0,
      bookedCount: 0,
      createdAt: '2026-04-10T18:44:00.000Z',
      updatedAt: '2026-04-10T18:44:00.000Z',
      deletedAt: null,
    },
  ];
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('campaigns.GET', userId);

  try {
    // TODO: Real query once Firestore is wired.
    const snap = await adminDb
      .collection('campaigns')
      .where('userId', '==', userId)
      .get();

    let campaigns: CampaignRecord[] = snap.docs
      .map((d) => d.data() as CampaignRecord)
      .filter((c) => !c.deletedAt);

    if (campaigns.length === 0) {
      campaigns = mockSeed(userId);
    }

    return NextResponse.json({ data: campaigns });
  } catch (err) {
    // Placeholder mode: Firestore isn't configured yet - return seed data
    // so the UI has something to render in dev / preview.
    console.warn('[api:campaigns.GET] falling back to mock seed', err);
    return NextResponse.json({ data: mockSeed(userId) });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createCampaignSchema);
  if (parsed.response) return parsed.response;

  logRequest('campaigns.POST', userId, { name: parsed.data.name });

  try {
    const now = new Date().toISOString();
    const id = `cmp_${Math.random().toString(36).slice(2, 12)}`;
    const record: CampaignRecord = {
      id,
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.scheduledAt ? 'scheduled' : 'draft',
      persona: parsed.data.persona,
      targetLeadCount: parsed.data.targetLeadCount,
      sentCount: 0,
      repliedCount: 0,
      bookedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // TODO: persist domainId / inboxIds / scheduledAt in sub-collections once schema finalised.
    try {
      await adminDb.collection('campaigns').doc(id).set(record);
    } catch (err) {
      console.warn('[api:campaigns.POST] Firestore write skipped (placeholder mode)', err);
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error('[api:campaigns.POST] error', err);
    return jsonError('Failed to create campaign');
  }
}
