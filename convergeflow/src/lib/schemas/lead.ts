import { z } from "zod";

export const leadStatusSchema = z.enum([
  "new",
  "contacted",
  "replied",
  "booked",
  "unsubscribed",
  "bounced",
  "flagged",
]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const leadSourceSchema = z.enum([
  "csv",
  "apollo",
  "aleads",
  "snov",
  "outscraper",
  "manual",
  "leadsgorilla",
]);
export type LeadSource = z.infer<typeof leadSourceSchema>;

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
  status: leadStatusSchema.default("new"),
  source: leadSourceSchema.default("manual"),
  tags: z.array(z.string()).default([]),
  enrichment: z.record(z.string(), z.unknown()).optional(),
  verified: z.boolean().optional(),
  verifiedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadListSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  source: leadSourceSchema.default("manual"),
  leadCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LeadList = z.infer<typeof leadListSchema>;

export const leadFilterSchema = z.object({
  industry: z.string().optional(),
  location: z.string().optional(),
  status: leadStatusSchema.optional(),
  listId: z.string().optional(),
  tags: z.string().optional(), // comma-separated tags filter
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type LeadFilter = z.infer<typeof leadFilterSchema>;

export const importLeadsSchema = z.object({
  source: leadSourceSchema.default("manual"),
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
      })
    )
    .min(1)
    .max(5000),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

export const leadSearchSchema = z.object({
  provider: z.enum(["aleads", "snov", "mock", "leadsgorilla"]).default("mock"),
  industry: z.string().min(1),
  location: z.string().min(1),
  count: z.number().int().positive().max(1000).default(50),
  titles: z.array(z.string()).optional(),
  keyword: z.string().optional(), // used by leadsgorilla provider
});
export type LeadSearchInput = z.infer<typeof leadSearchSchema>;

// ── Status update ────────────────────────────────────────────────────────────

export const updateLeadStatusSchema = z.object({
  status: leadStatusSchema,
});
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

// ── Tags ─────────────────────────────────────────────────────────────────────

export const updateLeadTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).min(1).max(50),
});
export type UpdateLeadTagsInput = z.infer<typeof updateLeadTagsSchema>;

// ── Enrichment ────────────────────────────────────────────────────────────────

export const enrichLeadSchema = z.object({
  provider: z.enum(["apollo", "aleads", "snov"]),
  fields: z.record(z.string(), z.unknown()),
});
export type EnrichLeadInput = z.infer<typeof enrichLeadSchema>;

// ── Bulk actions ──────────────────────────────────────────────────────────────

export const bulkLeadActionSchema = z.object({
  action: z.enum(["delete", "tag", "untag", "status"]),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  value: z.string().optional(),
});
export type BulkLeadActionInput = z.infer<typeof bulkLeadActionSchema>;

// ── Suppression ───────────────────────────────────────────────────────────────

export const suppressionReasonSchema = z.enum(["unsubscribed", "bounced", "manual"]);
export type SuppressionReason = z.infer<typeof suppressionReasonSchema>;

export const suppressionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  reason: suppressionReasonSchema,
  createdAt: z.string().datetime(),
});
export type Suppression = z.infer<typeof suppressionSchema>;

export const createSuppressionSchema = z.object({
  email: z.string().email(),
  reason: suppressionReasonSchema.default("manual"),
});
export type CreateSuppressionInput = z.infer<typeof createSuppressionSchema>;

// ── DNC (Do Not Contact — system-wide) ───────────────────────────────────────

export const dncSchema = z.object({
  email: z.string().email(),
  addedAt: z.string().datetime(),
  source: z.string().default("admin"),
});
export type DncEntry = z.infer<typeof dncSchema>;

export const createDncSchema = z.object({
  email: z.string().email(),
  source: z.string().default("admin"),
});
export type CreateDncInput = z.infer<typeof createDncSchema>;
