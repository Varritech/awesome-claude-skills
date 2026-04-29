import { z } from 'zod';

const personaEnum = z.enum(['closer', 'neighbor', 'expert', 'helper']);
const emailStatusEnum = z.enum(['draft', 'queued', 'sent', 'opened', 'replied', 'bounced']);

export const createEmailSchema = z.object({
  subject: z.string().max(255).optional().default(''),
  body: z.string().max(10000).optional().default(''),
  persona: personaEnum.optional().default('closer'),
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
});
export type CreateEmailInput = z.infer<typeof createEmailSchema>;

export const updateEmailSchema = z.object({
  subject: z.string().max(255).optional(),
  body: z.string().max(10000).optional(),
  persona: personaEnum.optional(),
  status: emailStatusEnum.optional(),
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
});
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
