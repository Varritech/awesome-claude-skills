/**
 * /api/leads - list & import leads.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { importLeadsSchema, leadFilterSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

interface LeadRecord {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  status: 'new' | 'contacted' | 'replied' | 'booked' | 'unsubscribed' | 'bounced';
  source: 'csv' | 'apollo' | 'aleads' | 'outscraper' | 'manual';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function mockSeed(userId: string): LeadRecord[] {
  const now = new Date().toISOString();
  const rows: Array<Partial<LeadRecord>> = [
    {
      id: 'ld_demo_1',
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex@acme.io',
      company: 'Acme SaaS',
      title: 'Head of Growth',
      industry: 'SaaS',
      location: 'New York, NY',
      status: 'contacted',
      source: 'apollo',
    },
    {
      id: 'ld_demo_2',
      firstName: 'Jordan',
      lastName: 'Patel',
      email: 'jordan@northside.dental',
      company: 'Northside Dental',
      title: 'Practice Owner',
      industry: 'Healthcare',
      location: 'Austin, TX',
      status: 'new',
      source: 'aleads',
    },
    {
      id: 'ld_demo_3',
      firstName: 'Sam',
      lastName: 'Ruiz',
      email: 'sam@hawkcap.com',
      company: 'Hawk Capital',
      title: 'Managing Partner',
      industry: 'Finance',
      location: 'Miami, FL',
      status: 'booked',
      source: 'manual',
    },
  ];
  return rows.map(
    (r) =>
      ({
        userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...r,
      }) as LeadRecord,
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = leadFilterSchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError('Invalid filters', 400, parsed.error.flatten());
  }
  const { industry, location, status, limit, cursor } = parsed.data;

  logRequest('leads.GET', userId, { industry, location, status, limit, cursor });

  try {
    let q = adminDb
      .collection('leads')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    if (industry) q = q.where('industry', '==', industry);
    if (location) q = q.where('location', '==', location);
    if (status) q = q.where('status', '==', status);
    if (cursor) {
      const cursorDoc = await adminDb.collection('leads').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }
    const snap = await q.get();
    const leads = snap.docs
      .map((d) => d.data() as LeadRecord)
      .filter((l) => !l.deletedAt);
    if (leads.length === 0) {
      const seed = mockSeed(userId);
      const filtered = seed.filter(
        (l) =>
          (!industry || l.industry === industry) &&
          (!location || l.location === location) &&
          (!status || l.status === status),
      );
      return NextResponse.json({ data: filtered, nextCursor: null });
    }
    const nextCursor = leads.length === limit ? leads[leads.length - 1]?.id : null;
    return NextResponse.json({ data: leads, nextCursor });
  } catch (err) {
    console.warn('[api:leads.GET] falling back to mock seed', err);
    return NextResponse.json({ data: mockSeed(userId), nextCursor: null });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, importLeadsSchema);
  if (parsed.response) return parsed.response;
  const { source, leads } = parsed.data;

  logRequest('leads.POST', userId, { source, count: leads.length });

  const now = new Date().toISOString();
  const inserted: LeadRecord[] = leads.map((l) => ({
    id: `ld_${Math.random().toString(36).slice(2, 12)}`,
    userId,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    company: l.company,
    title: l.title,
    industry: l.industry,
    location: l.location,
    status: 'new',
    source,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  try {
    // TODO: batch-write in 500-doc chunks once real Firestore is wired.
    for (const rec of inserted) {
      await adminDb.collection('leads').doc(rec.id).set(rec);
    }
  } catch (err) {
    console.warn('[api:leads.POST] placeholder mode', err);
  }

  return NextResponse.json(
    { data: { imported: inserted.length, source, leads: inserted } },
    { status: 201 },
  );
}
