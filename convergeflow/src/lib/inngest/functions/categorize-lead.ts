/**
 * Inngest function: lead/categorize
 *
 * Fired per lead after a pull is persisted. Confirms/refines the provisional
 * trade category using the LLM, optionally feeding a website-crawl excerpt so
 * the model can tell roofing from gutters from solar by what the company
 * actually does. Then writes the result + a recomputed real score back to the
 * lead doc.
 *
 * LinkedIn is auth-walled and is NOT crawled; provider title/company/industry
 * + linkedinUrl are passed as metadata only.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { ollamaClient } from '@/lib/ollama/client';
import * as Sentry from '@sentry/nextjs';
import { buildCategorizePrompt, parseCategory } from '@/lib/leads/categorize';
import { fetchWebsiteText } from '@/lib/leads/crawl';
import { scoreLead, titleSeniority } from '@/lib/leads/scoring';
import { statusToFreshness, type LeadRecord } from '@/lib/leads/ui';
import type { ParsedCategory } from '@/lib/leads/categorize';

export const categorizeLeadFn = inngest.createFunction(
  {
    id: 'categorize-lead',
    name: 'Categorize Lead',
    retries: 2,
    triggers: [{ event: 'lead/categorize' }],
  },
  async ({ event, step }) => {
    const { leadId } = event.data;

    const record = await step.run('load-lead', async () => {
      const snap = await adminDb.collection('leads').doc(leadId).get();
      if (!snap.exists) throw new Error(`Lead ${leadId} not found`);
      return snap.data() as LeadRecord;
    });

    await step.run('mark-categorizing', async () => {
      await adminDb.collection('leads').doc(leadId).set(
        { enrichmentStatus: 'categorizing', updatedAt: new Date().toISOString() },
        { merge: true },
      );
    });

    const excerpt = await step.run('crawl-website', async () => {
      if (!record.website) return null;
      return fetchWebsiteText(record.website);
    });

    const parsed = await step.run('ai-categorize', async () => {
      try {
        const { system, user } = buildCategorizePrompt(
          {
            company: record.company,
            title: record.title,
            industry: record.industry,
            linkedinUrl: record.linkedinUrl,
            website: record.website,
          },
          excerpt,
        );
        const raw = await ollamaClient.chat([
          { role: 'system', content: system },
          { role: 'user', content: user },
        ]);
        return parseCategory(raw);
      } catch (err) {
        Sentry.captureException(err, { tags: { module: 'categorize-lead', leadId } });
        return { category: '', confidence: 0, reasoning: 'ai-unavailable' } as ParsedCategory;
      }
    });

    const patch = applyCategorization({
      record,
      parsed,
      usedCrawl: Boolean(excerpt),
      now: new Date().toISOString(),
    });

    await step.run('write-lead', async () => {
      await adminDb.collection('leads').doc(leadId).set(patch, { merge: true });
    });

    return { leadId, category: patch.category ?? record.category, status: patch.enrichmentStatus ?? 'done' };
  },
);

// ─── Pure helper (unit-tested) ───────────────────────────────────────────────

export interface ApplyCategorizationInput {
  record: LeadRecord;
  parsed: ParsedCategory;
  usedCrawl: boolean;
  now: string;
}

/** Build the Firestore patch that applies an AI categorization result. */
export function applyCategorization({ record, parsed, usedCrawl, now }: ApplyCategorizationInput): Record<string, unknown> {
  if (!parsed.category) {
    // AI returned nothing usable — keep the provisional category, mark failed.
    return {
      enrichmentStatus: 'failed',
      categoryReasoning: parsed.reasoning || undefined,
      updatedAt: now,
    };
  }

  const providerConfidence = record.scoreBreakdown?.providerConfidence ?? 0.5;
  const { score, breakdown } = scoreLead({
    categoryConfidence: parsed.confidence,
    providerConfidence,
    hasEmail: Boolean(record.email),
    hasLinkedin: Boolean(record.linkedinUrl),
    hasPhone: Boolean(record.phone),
    seniority: titleSeniority(record.title),
    freshness: statusToFreshness(record.status),
  });

  return {
    category: parsed.category,
    categoryConfidence: parsed.confidence,
    categorySource: usedCrawl ? 'crawl' : 'ai',
    categoryReasoning: parsed.reasoning || undefined,
    enrichmentStatus: 'done',
    score,
    scoreBreakdown: breakdown,
    updatedAt: now,
  };
}