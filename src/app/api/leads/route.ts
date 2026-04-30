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
import * as snov from '@/lib/snov/client';
import * as aleads from '@/lib/aleads/client';

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
  source: 'csv' | 'apollo' | 'aleads' | 'snov' | 'outscraper' | 'manual';
  score?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

async function fetchExternalLeads(params: {
  industry?: string;
  location?: string;
  limit: number;
  userId: string;
}): Promise<LeadRecord[]> {
  const now = new Date().toISOString();
  const results: LeadRecord[] = [];
  const seen = new Set<string>();

  const add = (lead: LeadRecord) => {
    const key = lead.email?.toLowerCase() ?? `${lead.firstName}-${lead.lastName}-${lead.company}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(lead);
  };

  await Promise.all([
    aleads.isConfigured()
      ? aleads
          .searchContacts({ industry: params.industry, location: params.location, limit: params.limit })
          .then((res) => {
            for (const c of res.data ?? []) {
              add({
                id: `ld_al_${c.id}`,
                userId: params.userId,
                firstName: c.first_name,
                lastName: c.last_name,
                email: c.email,
                company: c.company,
                title: c.title,
                industry: c.industry ?? params.industry,
                location: c.location ?? params.location,
                status: 'new',
                source: 'aleads',
                score: c.confidence ? Math.round(c.confidence * 100) : 0,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              });
            }
          })
          .catch((err) => console.warn('[api:leads.GET] aleads failed', err))
      : Promise.resolve(),

    snov.isConfigured()
      ? snov
          .searchProspects({
            industry: params.industry ? [params.industry] : undefined,
            location: params.location ? [params.location] : undefined,
            limit: params.limit,
          })
          .then((res) => {
            for (const p of res.data ?? []) {
              add({
                id: `ld_sn_${p.id ?? Math.random().toString(36).slice(2, 10)}`,
                userId: params.userId,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
                company: p.currentCompany,
                title: p.currentTitle,
                industry: p.industry ?? params.industry,
                location: p.location ?? params.location,
                status: 'new',
                source: 'snov',
                score: p.emailStatus === 'valid' ? 80 : 40,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
              });
            }
          })
          .catch((err) => console.warn('[api:leads.GET] snov failed', err))
      : Promise.resolve(),
  ]);

  return results.slice(0, params.limit);
}

function mockSeed(userId: string): LeadRecord[] {
  const now = new Date().toISOString();
  return [
    { id: 'ld_demo_1', userId, firstName: 'Alex', lastName: 'Chen', email: 'alex@acme.io', company: 'Acme SaaS', title: 'Head of Growth', industry: 'SaaS', location: 'New York, NY', status: 'contacted', source: 'apollo', score: 0, createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'ld_demo_2', userId, firstName: 'Jordan', lastName: 'Patel', email: 'jordan@northside.dental', company: 'Northside Dental', title: 'Practice Owner', industry: 'Healthcare', location: 'Austin, TX', status: 'new', source: 'aleads', score: 0, createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'ld_demo_3', userId, firstName: 'Sam', lastName: 'Ruiz', email: 'sam@hawkcap.com', company: 'Hawk Capital', title: 'Managing Partner', industry: 'Finance', location: 'Miami, FL', status: 'booked', source: 'manual', score: 0, createdAt: now, updatedAt: now, deletedAt: null },
  ];
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

  // 1. Try Firestore
  try {
    const snap = await adminDb
      .collection('leads')
      .where('userId', '==', userId)
      .limit(200)
      .get();
    const firestoreLeads = snap.docs
      .map((d) => d.data() as LeadRecord)
      .filter((l) => !l.deletedAt)
      .filter((l) => (!industry || l.industry === industry) && (!location || l.location === location) && (!status || l.status === status))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, limit);

    if (firestoreLeads.length > 0) {
      const nextCursor = firestoreLeads.length === limit ? firestoreLeads[firestoreLeads.length - 1]?.id : null;
      return NextResponse.json({ data: firestoreLeads, nextCursor });
    }
  } catch (err) {
    console.warn('[api:leads.GET] firestore query failed, trying external', err);
  }

  // 2. Fetch live from ALeads + Snov, persist to Firestore, return
  if (snov.isConfigured() || aleads.isConfigured()) {
    try {
      const external = await fetchExternalLeads({ industry, location, limit: 20, userId });
      // Only keep contacts that have a valid email address
      const withEmail = external.filter((l) => l.email?.trim());
      if (withEmail.length > 0) {
        // Persist so future requests return from Firestore (no repeat API calls)
        // Strip undefined values — Firestore rejects docs with undefined fields
        const strip = (obj: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
        const batch = adminDb.batch();
        for (const rec of withEmail) {
          batch.set(adminDb.collection('leads').doc(rec.id), strip(rec as unknown as Record<string, unknown>));
        }
        await batch.commit();
        const filtered = withEmail
          .filter((l) => (!industry || l.industry === industry) && (!location || l.location === location) && (!status || l.status === status))
          .slice(0, limit);
        return NextResponse.json({ data: filtered, nextCursor: null });
      }
    } catch (err) {
      console.warn('[api:leads.GET] external fetch failed', err);
    }
  }

  // 3. Mock fallback
  const seed = mockSeed(userId).filter(
    (l) =>
      (!industry || l.industry === industry) &&
      (!location || l.location === location) &&
      (!status || l.status === status),
  );
  return NextResponse.json({ data: seed, nextCursor: null });
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
    score: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  try {
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
