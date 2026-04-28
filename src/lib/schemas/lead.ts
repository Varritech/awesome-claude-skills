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
  count: z.number().int().positive().max(1000).default(50),
  titles: z.array(z.string()).optional(),
});
export type LeadSearchInput = z.infer<typeof leadSearchSchema>;
