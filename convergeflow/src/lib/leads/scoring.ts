/**
 * Lead scoring — real, explainable, 0-100.
 *
 * Replaces the old `scoreFromId()` which fabricated a number by hashing the
 * doc id. Every term here comes from an observable signal, and `scoreBreakdown`
 * is persisted so the number is never "out of nowhere".
 *
 * Formula (raw, before clamping to 0-100):
 *   categoryConfidence * 30   (AI categorization confidence, 0-1)
 * + providerConfidence  * 20   (provider match confidence, 0-1)
 * + hasEmail            * 10
 * + hasLinkedin         * 5
 * + hasPhone            * 5
 * + seniorityBonus            (decision_maker 20, manager 10, individual/unknown 5)
 * + freshnessBonus            (new 10, warm 5, cold 0)
 */

export type Seniority = 'decision_maker' | 'manager' | 'individual' | 'unknown';
export type Freshness = 'new' | 'warm' | 'cold';

const SENIORITY_BONUS: Record<Seniority, number> = {
  decision_maker: 20,
  manager: 10,
  individual: 5,
  unknown: 5,
};

const FRESHNESS_BONUS: Record<Freshness, number> = {
  new: 10,
  warm: 5,
  cold: 0,
};

const DECISION_MAKER = /\b(founder|co-?founder|ceo|chief|owner|president|vp|vice president|managing partner|principal|partner)\b/i;
const MANAGER = /\b(director|manager|head of|lead)\b/i;

/** Infer seniority bucket from a job title. */
export function titleSeniority(title?: string): Seniority {
  if (!title || !title.trim()) return 'unknown';
  if (DECISION_MAKER.test(title)) return 'decision_maker';
  if (MANAGER.test(title)) return 'manager';
  return 'individual';
}

export interface ScoreInput {
  categoryConfidence?: number;
  providerConfidence?: number;
  hasEmail?: boolean;
  hasLinkedin?: boolean;
  hasPhone?: boolean;
  seniority?: Seniority;
  freshness?: Freshness;
}

export interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const categoryConfidence = clamp01(input.categoryConfidence ?? 0);
  const providerConfidence = clamp01(input.providerConfidence ?? 0);
  const seniority = input.seniority ?? 'unknown';
  const freshness = input.freshness ?? 'cold';

  const breakdown: Record<string, number> = {
    categoryConfidence: categoryConfidence * 30,
    providerConfidence: providerConfidence * 20,
    hasEmail: input.hasEmail ? 10 : 0,
    hasLinkedin: input.hasLinkedin ? 5 : 0,
    hasPhone: input.hasPhone ? 5 : 0,
    seniority: SENIORITY_BONUS[seniority],
    freshness: FRESHNESS_BONUS[freshness],
  };

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score: Math.min(100, Math.max(0, Math.round(raw))), breakdown };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}