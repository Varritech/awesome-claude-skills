/**
 * /api/leads/search - search external lead sources.
 *
 * Supported providers (set via `provider` body param):
 *   - aleads  → A-Leads API (requires ALEADS_API_KEY)
 *   - snov    → Snov.io prospect search (requires SNOV_CLIENT_ID + SNOV_CLIENT_SECRET)
 *   - mock    → deterministic placeholder data (default when no keys configured)
 *
 * If a real provider is requested but its env vars are absent, falls back to mock.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { leadSearchSchema } from '@/lib/schemas';
import * as aleads from '@/lib/aleads/client';
import * as snov from '@/lib/snov/client';

export const dynamic = 'force-dynamic';

// ─── Mock data (fallback) ────────────────────────────────────────────────────

const FIRST_NAMES = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Riley', 'Morgan', 'Casey', 'Drew', 'Jamie', 'Avery'];
const LAST_NAMES = ['Chen', 'Patel', 'Rivera', 'Nguyen', 'Kim', 'Walker', 'Brooks', 'Ortiz', 'Kumar', 'Foster'];
const COMPANIES = ['Acme', 'Northside', 'Hawk', 'Quill', 'Vanta', 'Riverside', 'Halo', 'Beacon', 'Lumen', 'Forge'];
const TITLES = ['Head of Growth', 'VP Marketing', 'Founder', 'Chief of Staff', 'Director of Sales', 'Practice Owner', 'Managing Partner', 'Operations Lead'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function mockResults(industry: string, location: string, count: number, titles?: string[]) {
  const total = Math.min(count, 50);
  return Array.from({ length: total }, (_, i) => {
    const firstName = pick(FIRST_NAMES, i);
    const lastName = pick(LAST_NAMES, i + 3);
    const company = `${pick(COMPANIES, i + 1)} ${['Labs', 'Group', 'Partners', 'Health', 'Capital'][i % 5]}`;
    const title = titles && titles.length > 0 ? pick(titles, i) : pick(TITLES, i);
    return {
      externalId: `mock_${Date.now()}_${i}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName}.${lastName}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
      company,
      title,
      industry,
      location,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}`,
      confidence: 0.78 + ((i * 13) % 20) / 100,
    };
  });
}

// ─── Provider adapters ───────────────────────────────────────────────────────

interface NormalizedLead {
  externalId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  phone?: string;
  confidence?: number;
}

async function fetchFromALeads(
  industry: string,
  location: string,
  count: number,
  titles?: string[],
): Promise<{ results: NormalizedLead[]; total: number }> {
  const res = await aleads.searchContacts({
    industry,
    location,
    title: titles,
    limit: Math.min(count, 200),
  });

  const results: NormalizedLead[] = res.data.map((c) => ({
    externalId: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    fullName: [c.first_name, c.last_name].filter(Boolean).join(' '),
    email: c.email,
    company: c.company,
    title: c.title,
    industry: c.industry ?? industry,
    location: c.location ?? location,
    linkedinUrl: c.linkedin_url,
    phone: c.phone,
    confidence: c.confidence,
  }));

  return { results, total: res.total };
}

async function fetchFromSnov(
  industry: string,
  location: string,
  count: number,
  titles?: string[],
): Promise<{ results: NormalizedLead[]; total: number }> {
  const res = await snov.searchProspects({
    industry: [industry],
    location: [location],
    position: titles,
    limit: Math.min(count, 200),
  });

  const results: NormalizedLead[] = (res.data ?? []).map((p, i) => ({
    externalId: p.id ?? `snov_${i}`,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    email: p.email,
    company: p.currentCompany,
    title: p.currentTitle,
    industry: p.industry ?? industry,
    location: p.location ?? location,
    linkedinUrl: p.linkedinUrl,
    phone: p.phone,
  }));

  return { results, total: res.total_count ?? results.length };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, leadSearchSchema);
  if (parsed.response) return parsed.response;
  const { provider, industry, location, count, titles } = parsed.data;

  logRequest('leads.search.POST', userId, { provider, industry, location, count });

  // Auto-downgrade to mock if the requested provider isn't configured
  const effectiveProvider =
    provider === 'aleads' && !aleads.isConfigured() ? 'mock' :
    provider === 'snov' && !snov.isConfigured() ? 'mock' :
    provider;

  if (effectiveProvider !== provider) {
    console.warn(`[api:leads.search] ${provider} not configured, falling back to mock`);
  }

  try {
    if (effectiveProvider === 'aleads') {
      const { results, total } = await fetchFromALeads(industry, location, count, titles);
      return NextResponse.json({
        data: { provider: 'aleads', query: { industry, location, count, titles }, total, results },
      });
    }

    if (effectiveProvider === 'snov') {
      const { results, total } = await fetchFromSnov(industry, location, count, titles);
      return NextResponse.json({
        data: { provider: 'snov', query: { industry, location, count, titles }, total, results },
      });
    }
  } catch (err) {
    console.warn(`[api:leads.search] ${effectiveProvider} fetch failed, falling back to mock`, err);
  }

  // Mock fallback
  const results = mockResults(industry, location, count, titles);
  return NextResponse.json({
    data: { provider: 'mock', query: { industry, location, count, titles }, total: results.length, results },
  });
}
