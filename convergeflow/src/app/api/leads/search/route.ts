/**
 * /api/leads/search — pull leads from an external source, persist once, dedup,
 * and fire AI categorization. DB-first on every subsequent pull for the same
 * query so we only ever hit the provider API once.
 *
 * Flow:
 *   1. Resolve provider (aleads / snov / mock-fallback).
 *   2. Force US-only: query the provider with location="United States" and
 *      post-filter results with filterUsOnly().
 *   3. Compute a pull fingerprint. If a fresh `lead_pulls` doc exists for
 *      (userId, fingerprint) → return the cached leads from the DB. No API call.
 *   4. Otherwise fetch → normalize → filterUsOnly → build records with
 *      deterministic dedup ids → upsert → write the pull doc → fire a
 *      `lead/categorize` Inngest event per new/un-enriched lead → return.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { leadSearchSchema, PULL_STALENESS_MS } from '@/lib/schemas';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';
import * as aleads from '@/lib/aleads/client';
import * as snov from '@/lib/snov/client';
import {
  buildLeadRecord,
  toUiResponse,
  filterUsOnly,
  pullFingerprint,
  type NormalizedLead,
  type LeadRecord,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

const US_LOCATION = 'United States';

// ─── Mock data (fallback when no provider is configured) ─────────────────────

const FIRST_NAMES = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Riley', 'Morgan', 'Casey', 'Drew', 'Jamie', 'Avery'];
const LAST_NAMES = ['Chen', 'Patel', 'Rivera', 'Nguyen', 'Kim', 'Walker', 'Brooks', 'Ortiz', 'Kumar', 'Foster'];
const US_CITIES = [
  'Austin, TX', 'Miami, FL', 'Denver, CO', 'Phoenix, AZ', 'Atlanta, GA',
  'Nashville, TN', 'Columbus, OH', 'Dallas, TX', 'Tampa, FL', 'Raleigh, NC',
];
const TITLES = ['Founder', 'Owner', 'VP Operations', 'Director of Sales', 'CEO', 'Operations Manager'];

function mockResults(industry: string, count: number, titles?: string[]): NormalizedLead[] {
  const total = Math.min(count, 50);
  return Array.from({ length: total }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i + 3) % LAST_NAMES.length]!;
    const company = `${['Acme', 'Northside', 'Hawk', 'Riverside', 'Beacon'][i % 5]!} ${industry}`;
    const title = titles && titles.length > 0 ? titles[i % titles.length]! : TITLES[i % TITLES.length]!;
    return {
      externalId: `mock_${i}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      company,
      title,
      industry,
      location: US_CITIES[i % US_CITIES.length]!,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}`,
      website: `https://www.${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      confidence: 0.78 + ((i * 13) % 20) / 100,
    } satisfies NormalizedLead;
  });
}

// ─── Provider adapters ───────────────────────────────────────────────────────

async function fetchFromALeads(industry: string, count: number, titles?: string[]): Promise<NormalizedLead[]> {
  const res = await aleads.searchContacts({
    industry,
    location: US_LOCATION,
    title: titles,
    limit: Math.min(count, 200),
  });
  return res.data.map((c) => ({
    externalId: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    fullName: [c.first_name, c.last_name].filter(Boolean).join(' '),
    email: c.email,
    company: c.company,
    title: c.title,
    industry: c.industry ?? industry,
    location: c.location ?? US_LOCATION,
    linkedinUrl: c.linkedin_url,
    phone: c.phone,
    confidence: c.confidence,
  } satisfies NormalizedLead));
}

async function fetchFromSnov(industry: string, count: number, titles?: string[]): Promise<NormalizedLead[]> {
  const res = await snov.searchProspects({
    industry: [industry],
    location: [US_LOCATION],
    position: titles,
    limit: Math.min(count, 200),
  });
  return (res.data ?? []).map((p, i) => ({
    externalId: p.id ?? `snov_${i}`,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    email: p.email,
    company: p.currentCompany,
    title: p.currentTitle,
    industry: p.industry ?? industry,
    location: p.location ?? US_LOCATION,
    linkedinUrl: p.linkedinUrl,
    phone: p.phone,
  } satisfies NormalizedLead));
}

// ─── Pull-record helpers ─────────────────────────────────────────────────────

function pullDocId(userId: string, fingerprint: string): string {
  return `${userId}_${fingerprint}`;
}

interface PullRecord {
  leadIds: string[];
  lastPulledAt: string;
}

async function readPullRecord(userId: string, fingerprint: string): Promise<PullRecord | null> {
  const snap = await adminDb.collection('lead_pulls').doc(pullDocId(userId, fingerprint)).get();
  if (!snap.exists) return null;
  const data = snap.data() as PullRecord;
  if (!data?.lastPulledAt) return null;
  const age = Date.now() - new Date(data.lastPulledAt).getTime();
  if (age < PULL_STALENESS_MS) return data;
  return null;
}

async function readLeadsByIds(ids: string[]): Promise<LeadRecord[]> {
  if (ids.length === 0) return [];
  const refs = ids.map((id) => adminDb.collection('leads').doc(id));
  const snaps = await adminDb.getAll(...refs);
  return snaps
    .filter((s) => s.exists)
    .map((s) => s.data() as LeadRecord)
    .filter((r) => !r.deletedAt);
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, leadSearchSchema);
  if (parsed.response) return parsed.response;
  const { provider, industry, count, titles } = parsed.data;

  // US-only is enforced regardless of the incoming location/country.
  const fingerprint = pullFingerprint({ provider, industry, location: US_LOCATION, titles });
  logRequest('leads.search.POST', userId, { provider, industry, count, fingerprint });

  // 1. DB-first: serve a fresh cached pull without touching the provider API.
  try {
    const cached = await readPullRecord(userId, fingerprint);
    if (cached) {
      const records = await readLeadsByIds(cached.leadIds);
      return NextResponse.json({ data: toUiResponse(records) });
    }
  } catch (err) {
    console.warn('[api:leads.search] cache read failed, proceeding to pull', err);
  }

  // 2. Resolve provider (aleads / snov / mock fallback).
  const effectiveProvider =
    provider === 'aleads' && !aleads.isConfigured() ? 'mock' :
    provider === 'snov' && !snov.isConfigured() ? 'mock' :
    provider;
  if (effectiveProvider !== provider) {
    console.warn(`[api:leads.search] ${provider} not configured, falling back to mock`);
  }

  let fetched: NormalizedLead[];
  try {
    if (effectiveProvider === 'aleads') fetched = await fetchFromALeads(industry, count, titles);
    else if (effectiveProvider === 'snov') fetched = await fetchFromSnov(industry, count, titles);
    else fetched = mockResults(industry, count, titles);
  } catch (err) {
    console.warn(`[api:leads.search] ${effectiveProvider} fetch failed, using mock`, err);
    fetched = mockResults(industry, count, titles);
  }

  // 3. US-only safety net + record construction.
  const usOnly = filterUsOnly(fetched);
  const now = new Date().toISOString();
  const records = usOnly.map((n) =>
    buildLeadRecord({ normalized: n, userId, provider: effectiveProvider, pullFingerprint: fingerprint, now }),
  );

  // 4. Upsert + detect which leads need categorization (new or not yet done).
  const categorizeEvents: Array<{ name: 'lead/categorize'; data: { leadId: string; userId: string } }> = [];
  const leadIds: string[] = [];

  for (const rec of records) {
    leadIds.push(rec.id);
    try {
      const existing = await adminDb.collection('leads').doc(rec.id).get();
      const needsCategorize = !existing.exists || (existing.data() as LeadRecord)?.enrichmentStatus !== 'done';
      await adminDb.collection('leads').doc(rec.id).set(rec, { merge: true });
      if (needsCategorize) {
        categorizeEvents.push({ name: 'lead/categorize', data: { leadId: rec.id, userId } });
      }
    } catch (err) {
      console.warn(`[api:leads.search] failed to upsert lead ${rec.id}`, err);
    }
  }

  // 5. Write/refresh the pull record.
  try {
    await adminDb.collection('lead_pulls').doc(pullDocId(userId, fingerprint)).set({
      id: pullDocId(userId, fingerprint),
      userId,
      fingerprint,
      provider: effectiveProvider,
      industry,
      location: US_LOCATION,
      titles: titles ?? [],
      leadIds,
      count: leadIds.length,
      lastPulledAt: now,
    });
  } catch (err) {
    console.warn('[api:leads.search] failed to write pull record', err);
  }

  // 6. Fire AI categorization for new/un-enriched leads.
  if (categorizeEvents.length > 0) {
    try {
      await inngest.send(categorizeEvents);
    } catch (err) {
      console.warn('[api:leads.search] failed to dispatch categorize events', err);
    }
  }

  return NextResponse.json({
    data: toUiResponse(records),
  });
}