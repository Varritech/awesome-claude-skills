import { describe, it, expect } from 'vitest';
import { applyCategorization } from './categorize-lead';
import { buildLeadRecord } from '@/lib/leads/ui';
import type { LeadRecord } from '@/lib/leads/ui';
import type { ParsedCategory } from '@/lib/leads/categorize';

const now = '2026-07-21T00:00:00.000Z';

function makeRecord(): LeadRecord {
  return buildLeadRecord({
    normalized: {
      externalId: 'ext-1',
      firstName: 'Alex',
      lastName: 'Chen',
      email: 'alex@acmeroofing.com',
      company: 'Acme Roofing',
      title: 'Owner',
      industry: 'Roofing Contractor',
      location: 'Austin, TX',
      linkedinUrl: 'https://linkedin.com/in/alex',
      confidence: 0.8,
    },
    userId: 'u1',
    provider: 'aleads',
    pullFingerprint: 'fp1',
    now,
  });
}

describe('applyCategorization', () => {
  it('writes the AI category, confidence, reasoning, and marks enrichment done', () => {
    const record = makeRecord();
    const parsed: ParsedCategory = { category: 'Roofing', confidence: 0.93, reasoning: 'Installs shingle roofs' };
    const patch = applyCategorization({ record, parsed, usedCrawl: false, now });
    expect(patch.category).toBe('Roofing');
    expect(patch.categoryConfidence).toBeCloseTo(0.93);
    expect(patch.categorySource).toBe('ai');
    expect(patch.categoryReasoning).toBe('Installs shingle roofs');
    expect(patch.enrichmentStatus).toBe('done');
    expect(patch.updatedAt).toBe(now);
  });

  it('marks categorySource as crawl when a website excerpt was used', () => {
    const record = makeRecord();
    const parsed: ParsedCategory = { category: 'Gutters', confidence: 0.7, reasoning: 'Site mentions gutters' };
    const patch = applyCategorization({ record, parsed, usedCrawl: true, now });
    expect(patch.categorySource).toBe('crawl');
  });

  it('recomputes a real score using the new category confidence', () => {
    const record = makeRecord();
    const before = record.score ?? 0;
    const parsed: ParsedCategory = { category: 'Roofing', confidence: 0.95, reasoning: '' };
    const patch = applyCategorization({ record, parsed, usedCrawl: false, now });
    expect(patch.score).toBeGreaterThanOrEqual(0);
    expect(patch.scoreBreakdown).toBeDefined();
    // Higher category confidence than the 0.5 provisional → score rises.
    expect(patch.score).toBeGreaterThan(before);
  });

  it('marks enrichment failed and keeps the provisional category when the AI returns nothing', () => {
    const record = makeRecord();
    const parsed: ParsedCategory = { category: '', confidence: 0, reasoning: 'garbage' };
    const patch = applyCategorization({ record, parsed, usedCrawl: false, now });
    expect(patch.enrichmentStatus).toBe('failed');
    expect(patch.category).toBeUndefined(); // do not overwrite the provisional category
    expect(patch.score).toBeUndefined();
  });
});