import { z } from 'zod';

export const personaSchema = z.enum(['closer', 'neighbor', 'expert', 'helper']);
export type Persona = z.infer<typeof personaSchema>;

export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'archived',
]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const emailStatusSchema = z.enum([
  'draft',
  'queued',
  'sent',
  'opened',
  'replied',
  'bounced',
]);
export type EmailStatus = z.infer<typeof emailStatusSchema>;

export const campaignSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  status: campaignStatusSchema.default('draft'),
  persona: personaSchema.default('closer'),
  targetLeadCount: z.number().int().nonnegative().optional(),
  domainId: z.string().optional(),
  inboxIds: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().nullable().optional(),
  trackingDomain: z.string().optional(),
  trackingEnabled: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  persona: personaSchema.default('closer'),
  targetLeadCount: z.number().int().positive().max(10_000).optional(),
  domainId: z.string().optional(),
  inboxIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  trackingDomain: z.string().optional(),
  trackingEnabled: z.boolean().optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  status: campaignStatusSchema.optional(),
  persona: personaSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const emailSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
  userId: z.string().min(1),
  subject: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  persona: personaSchema.default('closer'),
  status: emailStatusSchema.default('draft'),
  sentAt: z.string().datetime().nullable().optional(),
  openedAt: z.string().datetime().nullable().optional(),
  repliedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Email = z.infer<typeof emailSchema>;

export const createEmailSchema = z.object({
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
  subject: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  persona: personaSchema.default('closer'),
});
export type CreateEmailInput = z.infer<typeof createEmailSchema>;

export const updateEmailSchema = z.object({
  subject: z.string().max(200).optional(),
  body: z.string().max(20_000).optional(),
  status: emailStatusSchema.optional(),
});
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;

export const generateEmailSchema = z.object({
  persona: personaSchema,
  leadData: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      industry: z.string().optional(),
      location: z.string().optional(),
      email: z.string().email().optional(),
    })
    .catchall(z.unknown()),
  prompt: z.string().max(2000).optional(),
});
export type GenerateEmailInput = z.infer<typeof generateEmailSchema>;

export const templateSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  persona: personaSchema.default('closer'),
  subject: z.string().max(200),
  body: z.string().max(20_000),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Template = z.infer<typeof templateSchema>;

export const createTemplateSchema = templateSchema.pick({
  name: true,
  persona: true,
  subject: true,
  body: true,
  tags: true,
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
