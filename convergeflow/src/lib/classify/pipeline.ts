/**
 * Reply classification pipeline.
 *
 * Chains the rule-based auto-reply detector with the AI classifier:
 *   1. isAutoReply() → if true, return auto_reply (high confidence, no AI call)
 *   2. classifyReply() via Ollama → return AI category
 *   3. If Ollama fails, fall back to keyword matching
 */

import type { FetchedReply } from '@/lib/imap/client';
import type { ReplyCategory } from '@/lib/schemas/campaign';
import { autoReplyReason } from './detectors';
import { classifyReply, type ClassifyContext } from './classifier';

export interface ClassificationResult {
  category: ReplyCategory;
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable reason for the classification */
  reason: string;
  /** Whether AI was used (vs rule-based only) */
  usedAi: boolean;
}

/**
 * Run the full classification pipeline on a fetched reply.
 */
export async function classifyReplyPipeline(
  reply: FetchedReply,
  context: ClassifyContext = {},
): Promise<ClassificationResult> {
  // ── Step 1: Rule-based auto-reply detection ──────────────────────────────
  const autoReason = autoReplyReason(reply.headers, reply.bodyText);
  if (autoReason) {
    return {
      category: 'auto_reply',
      confidence: 'high',
      reason: autoReason,
      usedAi: false,
    };
  }

  // ── Step 2: AI classification ────────────────────────────────────────────
  try {
    const result = await classifyReply(reply.bodyText, context);
    return {
      category: result.category,
      confidence: result.confidence,
      reason: result.confidence === 'high'
        ? 'AI classified'
        : 'AI classified (keyword fallback)',
      usedAi: result.confidence === 'high',
    };
  } catch {
    // Shouldn't happen (classifyReply has its own fallback), but safety net
    return {
      category: 'question',
      confidence: 'low',
      reason: 'classification error, defaulted to question',
      usedAi: false,
    };
  }
}

/**
 * Map a ReplyCategory to a human-readable display label.
 */
export function categoryLabel(category: ReplyCategory): string {
  const labels: Record<ReplyCategory, string> = {
    interested: 'Interested',
    booked: 'Booked',
    question: 'Question',
    not_interested: 'Not Interested',
    auto_reply: 'Auto Reply',
  };
  return labels[category];
}

/**
 * Map a ReplyCategory to a UI badge color.
 */
export function categoryBadgeColor(category: ReplyCategory): 'mint' | 'default' {
  if (category === 'interested' || category === 'booked') return 'mint';
  return 'default';
}

/**
 * Map a ReplyCategory to a chart color.
 */
export function categoryChartColor(category: ReplyCategory): string {
  const colors: Record<ReplyCategory, string> = {
    interested: '#22C55E',
    booked: '#3B82F6',
    question: '#F59E0B',
    not_interested: '#EF4444',
    auto_reply: '#6B7280',
  };
  return colors[category];
}
