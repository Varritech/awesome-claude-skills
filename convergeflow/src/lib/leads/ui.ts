/**
 * Lead record construction + UI mapping.
 *
 * Shared by `/api/leads` (browse) and `/api/leads/search` (pull+persist) so
 * both code paths produce identical shapes. Keeps the route handlers thin —
 * all testable logic lives here.
 */
import type { Lead, LeadSource, LeadStatus } from '@/lib/schemas/lead';
import { dedupId } from './dedup';
import { mapProviderIndustryToTrade } from './categorize';
import { scoreLead, titleSeniority, type Freshness, type Seniority } from './scoring';

/** Provider-normalized lead (output of an aleads/snov/mock fetch). */
export interface NormalizedLead {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  website?: string;
  phone?: string;
  confidence?: number;
}

/** Internal Firestore doc type (lead + soft-delete marker). */
export type LeadRecord = Lead & { deletedAt?: string | null };

/** UI-facing lead (what the customers page renders). */
export interface UiLead {
  id: string;
  name: string;
  company: string;
  industry: string;
  category?: string;
  location: string;
  freshness: Freshness;
  score: number;
  enrichmentStatus?: string;
}

export interface UiLeadsResponse {
  leads: UiLead[];
  categories: string[];
  /** True when the DB has no leads for this filter and a pull should be triggered. */
  needsPull?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function statusToFreshness(status: LeadStatus): Freshness {
  if (status === 'new') return 'new';
  if (status === 'contacted' || status === 'replied' || status === 'booked') return 'warm';
  return 'cold';
}

/** Only keep a URL field if it actually parses; provider data is messy. */
function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return url;
  } catch {
    return undefined;
  }
}

/** Map a pull provider string to the persisted leadSource enum. */
function providerToSource(provider: string): LeadSource {
  if (provider === 'aleads' || provider === 'snov' || provider === 'apollo' || provider === 'outscraper') {
    return provider;
  }
  return 'manual';
}

// ─── Record construction ─────────────────────────────────────────────────────

export interface BuildLeadRecordInput {
  normalized: NormalizedLead;
  userId: string;
  provider: string;
  pullFingerprint: string;
  now: string;
}

/**
 * Build a full lead record from a provider-normalized lead, with a provisional
 * trade category and a real explainable score. The doc id is the deterministic
 * dedup key, so re-pulling the same lead upserts instead of duplicating.
 */
export function buildLeadRecord({ normalized, userId, provider, pullFingerprint, now }: BuildLeadRecordInput): LeadRecord {
  const id = dedupId({ provider, externalId: normalized.externalId, email: normalized.email });
  const provisionalCategory = mapProviderIndustryToTrade(normalized.industry);
  const providerConfidence = normalized.confidence ?? 0.5;
  const seniority: Seniority = titleSeniority(normalized.title);

  const { score, breakdown } = scoreLead({
    // Provisional category confidence — the AI job will refine this.
    categoryConfidence: 0.5,
    providerConfidence,
    hasEmail: Boolean(normalized.email),
    hasLinkedin: Boolean(normalized.linkedinUrl),
    hasPhone: Boolean(normalized.phone),
    seniority,
    freshness: 'new',
  });

  return {
    id,
    userId,
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    email: normalized.email,
    company: normalized.company,
    title: normalized.title,
    industry: normalized.industry,
    location: normalized.location,
    linkedinUrl: safeUrl(normalized.linkedinUrl),
    phone: normalized.phone,
    website: safeUrl(normalized.website),
    externalId: normalized.externalId,
    externalProvider: provider,
    category: provisionalCategory,
    categoryConfidence: 0.5,
    categorySource: 'provider',
    score,
    scoreBreakdown: breakdown,
    enrichmentStatus: 'pending',
    pullFingerprint,
    status: 'new',
    source: providerToSource(provider),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

// ─── UI mapping ──────────────────────────────────────────────────────────────

/** Recompute a score from record fields when a persisted score is missing. */
function scoreFromRecord(r: LeadRecord): { score: number; breakdown: Record<string, number> } {
  if (typeof r.score === 'number' && r.scoreBreakdown) {
    return { score: r.score, breakdown: r.scoreBreakdown };
  }
  return scoreLead({
    categoryConfidence: r.categoryConfidence ?? 0.5,
    providerConfidence: 0.5,
    hasEmail: Boolean(r.email),
    hasLinkedin: Boolean(r.linkedinUrl),
    hasPhone: Boolean(r.phone),
    seniority: titleSeniority(r.title),
    freshness: statusToFreshness(r.status),
  });
}

export function toUiLead(r: LeadRecord): UiLead {
  const { score } = scoreFromRecord(r);
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || r.id;
  return {
    id: r.id,
    name,
    company: r.company ?? '',
    industry: r.industry ?? '',
    category: r.category,
    location: r.location ?? '',
    freshness: statusToFreshness(r.status),
    score,
    enrichmentStatus: r.enrichmentStatus,
  };
}

export function toUiResponse(records: LeadRecord[], needsPull = false): UiLeadsResponse {
  const leads = records.filter((r) => !r.deletedAt).map(toUiLead);
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const r of records) {
    if (r.deletedAt) continue;
    const c = r.category?.trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      categories.push(c);
    }
  }
  return { leads, categories, needsPull };
}