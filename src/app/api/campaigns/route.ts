/**
 * /api/campaigns - list & create campaigns.
 *
 * All reads/writes are scoped by `userId`. No mock fallback: empty Firestore
 * returns `{ data: [] }` and the UI renders its empty state. Firestore errors
 * propagate as 500 so the operator can see them.
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

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('campaigns.GET', userId);

  try {
    const snap = await adminDb
      .collection('campaigns')
      .where('userId', '==', userId)
      .get();

    const campaigns: CampaignRecord[] = snap.docs
      .map((d) => d.data() as CampaignRecord)
      .filter((c) => !c.deletedAt);

    return NextResponse.json({ data: campaigns });
  } catch (err) {
    console.error('[api:campaigns.GET] firestore error', err);
    return jsonError('Failed to load campaigns', 500);
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

    await adminDb.collection('campaigns').doc(id).set(record);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error('[api:campaigns.POST] error', err);
    return jsonError('Failed to create campaign');
  }
}
