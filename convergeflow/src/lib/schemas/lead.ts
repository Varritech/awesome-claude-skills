import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'replied',
  'booked',
  'unsubscribed',
  'bounced',
]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const leadSourceSchema = z.enum([
  'csv',
  'apollo',
  'aleads',
  'snov',
  'outscraper',
  'manual',
]);
export type LeadSource = z.infer<typeof leadSourceSchema>;

/** How a lead's trade category was assigned. */
export const categorySourceSchema = z.enum(['provider', 'ai', 'crawl']);
export type CategorySource = z.infer<typeof categorySourceSchema>;

/** Lifecycle of the async AI enrichment/categorization job for a lead. */
export const enrichmentStatusSchema = z.enum([
  'pending',
  'categorizing',
  'done',
  'failed',
]);
export type EnrichmentStatus = z.infer<typeof enrichmentStatusSchema>;

export const leadSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  listId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  // De-duplication against the external provider.
  externalId: z.string().optional(),
  externalProvider: z.string().optional(),
  // AI categorization into a trade.
  category: z.string().optional(),
  categoryConfidence: z.number().min(0).max(1).optional(),
  categorySource: categorySourceSchema.optional(),
  categoryReasoning: z.string().optional(),
  // Real, explainable score.
  score: z.number().int().min(0).max(100).optional(),
  scoreBreakdown: z.record(z.string(), z.number()).optional(),
  // Async enrichment lifecycle.
  enrichmentStatus: enrichmentStatusSchema.optional(),
  // Which pull query this lead came from (hash from pullFingerprint()).
  pullFingerprint: z.string().optional(),
  status: leadStatusSchema.default('new'),
  source: leadSourceSchema.default('manual'),
  enrichment: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadListSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  source: leadSourceSchema.default('manual'),
  leadCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LeadList = z.infer<typeof leadListSchema>;

export const leadFilterSchema = z.object({
  industry: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  status: leadStatusSchema.optional(),
  listId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type LeadFilter = z.infer<typeof leadFilterSchema>;

export const importLeadsSchema = z.object({
  source: leadSourceSchema.default('manual'),
  listId: z.string().optional(),
  leads: z
    .array(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        industry: z.string().optional(),
        location: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
        externalId: z.string().optional(),
      }),
    )
    .min(1)
    .max(5000),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

export const leadSearchSchema = z.object({
  provider: z.enum(['aleads', 'snov', 'mock']).default('mock'),
  industry: z.string().min(1),
  location: z.string().min(1),
  country: z.string().default('US'),
  count: z.number().int().positive().max(1000).default(50),
  titles: z.array(z.string()).optional(),
});
export type LeadSearchInput = z.infer<typeof leadSearchSchema>;

/**
 * Record of a completed pull — one doc per (userId, fingerprint) in the
 * `lead_pulls` collection. Its existence means a query has already been run
 * and subsequent requests should serve from the DB instead of re-calling the
 * provider API.
 */
export const leadPullSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  fingerprint: z.string().min(1),
  provider: z.string().min(1),
  industry: z.string(),
  location: z.string(),
  titles: z.array(z.string()).default([]),
  leadIds: z.array(z.string()).default([]),
  count: z.number().int().nonnegative().default(0),
  lastPulledAt: z.string().datetime(),
});
export type LeadPull = z.infer<typeof leadPullSchema>;

/** How long a pull is considered fresh before we re-call the provider. */
export const PULL_STALENESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
