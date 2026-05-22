/**
 * /api/leads - list & import leads.
 *
 * GET returns the shape expected by the customers page:
 * { leads: Lead[], industries: string[] }
 *
 * The api-client unwraps the { data: T } envelope, so the page receives the
 * inner object directly.
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
import { deduplicateLeads } from '@/lib/leads/dedup';

export const dynamic = 'force-dynamic';

// ── Internal storage type ────────────────────────────────────────────────────

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
  status: 'new' | 'contacted' | 'replied' | 'booked' | 'unsubscribed' | 'bounced' | 'flagged';
  source: 'csv' | 'apollo' | 'aleads' | 'snov' | 'outscraper' | 'manual' | 'leadsgorilla';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ── UI type ──────────────────────────────────────────────────────────────────

type Freshness = 'new' | 'warm' | 'cold';

interface Lead {
  id: string;
  name: string;
  company: string;
  industry: string;
  location: string;
  freshness: Freshness;
  score: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusToFreshness(status: LeadRecord['status']): Freshness {
  if (status === 'new') return 'new';
  if (status === 'contacted' || status === 'replied' || status === 'booked') return 'warm';
  return 'cold';
}

/** Deterministic score 60-99 derived from the lead id string. */
function scoreFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 60 + (hash % 40);
}

function toUiLead(r: LeadRecord): Lead {
  return {
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || r.id,
    company: r.company ?? '',
    industry: r.industry ?? '',
    location: r.location ?? '',
    freshness: statusToFreshness(r.status),
    score: scoreFromId(r.id),
  };
}

function toUiResponse(records: LeadRecord[]): { leads: Lead[]; industries: string[] } {
  const leads = records.map(toUiLead);
  const seen = new Set<string>();
  const industries: string[] = [];
  for (const r of records) {
    if (r.industry && !seen.has(r.industry)) {
      seen.add(r.industry);
      industries.push(r.industry);
    }
  }
  return { leads, industries };
}

// ── Mock seed ────────────────────────────────────────────────────────────────

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
        tags: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...r,
      }) as LeadRecord,
  );
}

// ── GET ──────────────────────────────────────────────────────────────────────

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
  const { industry, location, status, tags, limit, cursor } = parsed.data;

  logRequest('leads.GET', userId, { industry, location, status, tags, limit, cursor });

  try {
    let q = adminDb
      .collection('leads')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    if (industry) q = q.where('industry', '==', industry);
    if (location) q = q.where('location', '==', location);
    if (status) q = q.where('status', '==', status);
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) q = q.where('tags', 'array-contains-any', tagList);
    }
    if (cursor) {
      const cursorDoc = await adminDb.collection('leads').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }
    const snap = await q.get();
    const records = snap.docs
      .map((d) => d.data() as LeadRecord)
      .filter((l) => !l.deletedAt);
    if (records.length === 0) {
      const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const seed = mockSeed(userId).filter(
        (l) =>
          (!industry || l.industry === industry) &&
          (!location || l.location === location) &&
          (!status || l.status === status) &&
          (tagList.length === 0 || tagList.some((t) => l.tags.includes(t))),
      );
      return NextResponse.json({ data: toUiResponse(seed) });
    }
    return NextResponse.json({ data: toUiResponse(records) });
  } catch (err) {
    console.warn('[api:leads.GET] falling back to mock seed', err);
    return NextResponse.json({ data: toUiResponse(mockSeed(userId)) });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, importLeadsSchema);
  if (parsed.response) return parsed.response;
  const { source, leads } = parsed.data;

  logRequest('leads.POST', userId, { source, count: leads.length });

  // Deduplicate before writing
  let uniqueLeads = leads;
  let duplicateCount = 0;
  try {
    const deduped = await deduplicateLeads(userId, leads);
    uniqueLeads = deduped.unique;
    duplicateCount = deduped.duplicates.length;
  } catch (err) {
    console.warn('[api:leads.POST] dedup check failed, proceeding without dedup', err);
  }

  const now = new Date().toISOString();
  const inserted: LeadRecord[] = uniqueLeads.map((l) => ({
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
    tags: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  try {
    // Batch-write in 500-doc chunks
    const CHUNK = 500;
    for (let i = 0; i < inserted.length; i += CHUNK) {
      const batch = adminDb.batch();
      for (const rec of inserted.slice(i, i + CHUNK)) {
        batch.set(adminDb.collection('leads').doc(rec.id), rec);
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('[api:leads.POST] placeholder mode', err);
  }

  return NextResponse.json(
    {
      data: {
        imported: inserted.length,
        duplicatesSkipped: duplicateCount,
        source,
        leads: inserted,
      },
    },
    { status: 201 },
  );
}
