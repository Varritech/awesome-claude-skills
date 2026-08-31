import { describe, it, expect } from 'vitest';
import { dedupId } from './dedup';
import { pullFingerprint } from './pull';
import { isUsLocation, filterUsOnly } from './us-filter';
import { titleSeniority, scoreLead } from './scoring';
import {
  mapProviderIndustryToTrade,
  buildCategorizePrompt,
  parseCategory,
} from './categorize';
import { buildLeadRecord, toUiLead, toUiResponse, statusToFreshness } from './ui';
import type { NormalizedLead } from './ui';
import { stripHtml } from './crawl';

describe('dedupId', () => {
  it('is deterministic for the same provider + externalId', () => {
    const a = dedupId({ provider: 'aleads', externalId: 'abc-123', email: 'x@y.com' });
    const b = dedupId({ provider: 'aleads', externalId: 'abc-123', email: 'x@y.com' });
    expect(a).toBe(b);
    expect(a).toBe('ld_aleads_abc-123');
  });

  it('falls back to a hashed email id when no externalId is present', () => {
    const id = dedupId({ provider: 'aleads', externalId: undefined, email: 'Jane@Example.com' });
    expect(id).toMatch(/^ld_email_[0-9a-f]{40}$/);
  });

  it('normalizes email before hashing so case differences dedup', () => {
    const a = dedupId({ provider: 'aleads', externalId: undefined, email: 'Jane@Example.com' });
    const b = dedupId({ provider: 'aleads', externalId: undefined, email: 'jane@example.com' });
    expect(a).toBe(b);
  });

  it('strips "/" from externalId so the result is a safe Firestore doc id', () => {
    const id = dedupId({ provider: 'aleads', externalId: 'grp/abc/123', email: 'x@y.com' });
    expect(id).not.toContain('/');
    expect(id).toBe('ld_aleads_grpabc123');
  });
});

describe('pullFingerprint', () => {
  it('is deterministic for the same query inputs', () => {
    const a = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'United States', titles: ['Owner'] });
    const b = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'United States', titles: ['Owner'] });
    expect(a).toBe(b);
  });

  it('changes when any input changes', () => {
    const base = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'United States', titles: [] });
    expect(pullFingerprint({ provider: 'aleads', industry: 'Solar', location: 'United States', titles: [] })).not.toBe(base);
    expect(pullFingerprint({ provider: 'mock', industry: 'Roofing', location: 'United States', titles: [] })).not.toBe(base);
    expect(pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'United States', titles: ['Owner'] })).not.toBe(base);
  });

  it('is order-insensitive for titles', () => {
    const a = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'US', titles: ['Owner', 'Founder'] });
    const b = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'US', titles: ['Founder', 'Owner'] });
    expect(a).toBe(b);
  });

  it('ignores case differences in industry/location', () => {
    const a = pullFingerprint({ provider: 'aleads', industry: 'Roofing', location: 'United States', titles: [] });
    const b = pullFingerprint({ provider: 'aleads', industry: 'roofing', location: 'united states', titles: [] });
    expect(a).toBe(b);
  });
});

describe('isUsLocation', () => {
  it.each([
    ['New York, NY', true],
    ['Austin, TX', true],
    ['Miami, FL', true],
    ['United States', true],
    ['USA', true],
    ['U.S.', true],
    ['San Francisco, California', true],
    ['Toronto, ON', false],
    ['London, UK', false],
    ['Berlin, Germany', false],
    ['', false],
    ['   ', false],
  ])('classifies %p as US=%p', (loc, expected) => {
    expect(isUsLocation(loc)).toBe(expected);
  });
});

describe('filterUsOnly', () => {
  it('keeps only US-located leads and preserves order', () => {
    const leads = [
      { id: '1', location: 'Austin, TX' },
      { id: '2', location: 'London, UK' },
      { id: '3', location: 'Miami, FL' },
      { id: '4', location: 'Toronto, ON' },
    ] as Array<{ id: string; location: string }>;
    const kept = filterUsOnly(leads);
    expect(kept.map((l) => l.id)).toEqual(['1', '3']);
  });

  it('returns an empty array when no leads are US-located', () => {
    expect(filterUsOnly([{ id: 'x', location: 'Paris, France' }])).toEqual([]);
  });
});

describe('titleSeniority', () => {
  it.each([
    ['Founder', 'decision_maker'],
    ['Co-Founder', 'decision_maker'],
    ['CEO', 'decision_maker'],
    ['Chief Executive Officer', 'decision_maker'],
    ['Chief Technology Officer', 'decision_maker'],
    ['Owner', 'decision_maker'],
    ['President', 'decision_maker'],
    ['Vice President of Sales', 'decision_maker'],
    ['VP Marketing', 'decision_maker'],
    ['Managing Partner', 'decision_maker'],
    ['Director of Operations', 'manager'],
    ['Head of Growth', 'manager'],
    ['Operations Manager', 'manager'],
    ['Marketing Specialist', 'individual'],
    ['Analyst', 'individual'],
    ['', 'unknown'],
    [undefined, 'unknown'],
  ])('classifies title %p as %p', (title, expected) => {
    expect(titleSeniority(title)).toBe(expected);
  });
});

describe('scoreLead', () => {
  it('clamps the result to 0-100', () => {
    const low = scoreLead({ categoryConfidence: 0, providerConfidence: 0, hasEmail: false, hasLinkedin: false, hasPhone: false, seniority: 'individual', freshness: 'cold' });
    const high = scoreLead({ categoryConfidence: 1, providerConfidence: 1, hasEmail: true, hasLinkedin: true, hasPhone: true, seniority: 'decision_maker', freshness: 'new' });
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(100);
    expect(high.score).toBe(100);
  });

  it('includes an explainable breakdown that sums (pre-clamp) to the raw score', () => {
    const { score, breakdown } = scoreLead({ categoryConfidence: 0.8, providerConfidence: 0.5, hasEmail: true, hasLinkedin: false, hasPhone: true, seniority: 'manager', freshness: 'warm' });
    const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
    expect(score).toBe(Math.min(100, Math.round(raw)));
    expect(breakdown).toHaveProperty('categoryConfidence');
    expect(breakdown).toHaveProperty('providerConfidence');
    expect(breakdown).toHaveProperty('seniority');
    expect(breakdown).toHaveProperty('freshness');
  });

  it('rewards a decision-maker with email + LinkedIn above a bare individual lead', () => {
    const strong = scoreLead({ categoryConfidence: 0.9, providerConfidence: 0.7, hasEmail: true, hasLinkedin: true, hasPhone: false, seniority: 'decision_maker', freshness: 'new' });
    const weak = scoreLead({ categoryConfidence: 0.3, providerConfidence: 0.2, hasEmail: false, hasLinkedin: false, hasPhone: false, seniority: 'individual', freshness: 'cold' });
    expect(strong.score).toBeGreaterThan(weak.score);
  });
});

describe('mapProviderIndustryToTrade', () => {
  it.each([
    ['Roofing Contractor', 'Roofing'],
    ['Roofers', 'Roofing'],
    ['Gutter Services', 'Gutters'],
    ['Solar Installation', 'Solar'],
    ['HVAC', 'HVAC'],
    ['Heating & Cooling', 'HVAC'],
    ['Plumbing', 'Plumbing'],
    ['Plumber', 'Plumbing'],
    ['Window Installation', 'Windows'],
  ])('maps %p → %p', (industry, trade) => {
    expect(mapProviderIndustryToTrade(industry)).toBe(trade);
  });

  it('falls back to a title-cased version of the raw industry when unknown', () => {
    expect(mapProviderIndustryToTrade('pool cleaning')).toBe('Pool Cleaning');
  });

  it('returns Other for an empty industry', () => {
    expect(mapProviderIndustryToTrade('')).toBe('Other');
    expect(mapProviderIndustryToTrade(undefined)).toBe('Other');
  });
});

describe('buildCategorizePrompt', () => {
  it('includes the lead company, title, and industry in the user message', () => {
    const { system, user } = buildCategorizePrompt({
      company: 'Acme Roofing',
      title: 'Owner',
      industry: 'Roofing Contractor',
      linkedinUrl: 'https://linkedin.com/in/x',
    });
    expect(system).toContain('category');
    expect(user).toContain('Acme Roofing');
    expect(user).toContain('Owner');
    expect(user).toContain('Roofing Contractor');
  });

  it('includes a website excerpt when provided', () => {
    const { user } = buildCategorizePrompt({ company: 'Acme', title: 'Owner', industry: 'Roofing' }, 'We install shingle roofs and gutters.');
    expect(user).toContain('We install shingle roofs and gutters.');
  });
});

describe('parseCategory', () => {
  it('parses a clean JSON response', () => {
    const raw = '{"category":"Roofing","confidence":0.92,"reasoning":"Installs roofs"}';
    const r = parseCategory(raw);
    expect(r.category).toBe('Roofing');
    expect(r.confidence).toBeCloseTo(0.92);
    expect(r.reasoning).toBe('Installs roofs');
  });

  it('parses JSON wrapped in prose / markdown fences', () => {
    const raw = '```json\n{"category":"Solar","confidence":0.8,"reasoning":"Solar panels"}\n```';
    const r = parseCategory(raw);
    expect(r.category).toBe('Solar');
    expect(r.confidence).toBeCloseTo(0.8);
  });

  it('clamps confidence to 0-1', () => {
    const r = parseCategory('{"category":"HVAC","confidence":1.5,"reasoning":""}');
    expect(r.confidence).toBe(1);
  });

  it('falls back to category="" confidence=0 when the response is garbage', () => {
    const r = parseCategory('I am not sure what you want.');
    expect(r.category).toBe('');
    expect(r.confidence).toBe(0);
  });
});

const normalized: NormalizedLead = {
  externalId: 'ext-1',
  firstName: 'Alex',
  lastName: 'Chen',
  email: 'alex@acmeroofing.com',
  company: 'Acme Roofing',
  title: 'Owner',
  industry: 'Roofing Contractor',
  location: 'Austin, TX',
  linkedinUrl: 'https://linkedin.com/in/alex',
  phone: '512-555-1212',
  confidence: 0.8,
};

describe('buildLeadRecord', () => {
  const now = '2026-07-21T00:00:00.000Z';

  it('uses a deterministic dedup id derived from provider + externalId', () => {
    const r = buildLeadRecord({ normalized, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now });
    expect(r.id).toBe('ld_aleads_ext-1');
  });

  it('assigns a provisional trade category from the provider industry with enrichment pending', () => {
    const r = buildLeadRecord({ normalized, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now });
    expect(r.category).toBe('Roofing');
    expect(r.categorySource).toBe('provider');
    expect(r.enrichmentStatus).toBe('pending');
    expect(r.pullFingerprint).toBe('fp1');
  });

  it('computes a real score with a breakdown', () => {
    const r = buildLeadRecord({ normalized, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.scoreBreakdown).toBeDefined();
    expect(r.scoreBreakdown?.hasEmail).toBe(10);
  });

  it('falls back to an email-based dedup id when externalId is missing', () => {
    const r = buildLeadRecord({ normalized: { ...normalized, externalId: undefined }, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now });
    expect(r.id).toMatch(/^ld_email_[0-9a-f]{40}$/);
  });
});

describe('statusToFreshness', () => {
  it.each([
    ['new', 'new'],
    ['contacted', 'warm'],
    ['replied', 'warm'],
    ['booked', 'warm'],
    ['unsubscribed', 'cold'],
    ['bounced', 'cold'],
  ] as const)('maps status %p → freshness %p', (status, freshness) => {
    expect(statusToFreshness(status)).toBe(freshness);
  });
});

describe('toUiLead', () => {
  const now = '2026-07-21T00:00:00.000Z';
  const record = buildLeadRecord({ normalized, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now });

  it('derives a display name and preserves category + enrichment status', () => {
    const ui = toUiLead(record);
    expect(ui.name).toBe('Alex Chen');
    expect(ui.company).toBe('Acme Roofing');
    expect(ui.location).toBe('Austin, TX');
    expect(ui.category).toBe('Roofing');
    expect(ui.enrichmentStatus).toBe('pending');
    expect(ui.freshness).toBe('new');
    expect(ui.score).toBe(record.score);
  });

  it('falls back to email then id when no name is present', () => {
    const ui = toUiLead({ ...record, firstName: undefined, lastName: undefined });
    expect(ui.name).toBe('alex@acmeroofing.com');
  });
});

describe('toUiResponse', () => {
  const now = '2026-07-21T00:00:00.000Z';
  const records = [
    buildLeadRecord({ normalized, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now }),
    buildLeadRecord({ normalized: { ...normalized, externalId: 'ext-2', company: 'Sun Solar', industry: 'Solar Installation', location: 'Miami, FL' }, userId: 'u1', provider: 'aleads', pullFingerprint: 'fp1', now }),
  ];

  it('returns leads plus the distinct categories present (no "All")', () => {
    const res = toUiResponse(records);
    expect(res.leads).toHaveLength(2);
    expect(res.categories).toEqual(expect.arrayContaining(['Roofing', 'Solar']));
    expect(res.categories).not.toContain('All');
  });

  it('skips soft-deleted records', () => {
    const res = toUiResponse([{ ...records[0], deletedAt: now }]);
    expect(res.leads).toHaveLength(0);
  });
});

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    const text = stripHtml('<html><body><h1>Acme Roofing</h1><p>We install shingle roofs.</p></body></html>');
    expect(text).toBe('Acme Roofing We install shingle roofs.');
  });

  it('returns an empty string for tag-only input', () => {
    expect(stripHtml('<div></div>')).toBe('');
  });
});