import { z } from 'zod';

export const domainStatusSchema = z.enum([
  'pending',
  'dns_configured',
  'warming',
  'active',
  'blocked',
]);
export type DomainStatus = z.infer<typeof domainStatusSchema>;

export const inboxProviderSchema = z.enum(['gmail', 'yahoo', 'smtp_imap']);
export type InboxProvider = z.infer<typeof inboxProviderSchema>;

export const inboxStatusSchema = z.enum([
  'connecting',
  'connected',
  'warming',
  'active',
  'disconnected',
  'error',
]);
export type InboxStatus = z.infer<typeof inboxStatusSchema>;

export const domainSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Must be a valid domain'),
  purpose: z.enum(['primary', 'sending']).default('sending'),
  status: domainStatusSchema.default('pending'),
  spfValid: z.boolean().default(false),
  dkimValid: z.boolean().default(false),
  dmarcValid: z.boolean().default(false),
  mxValid: z.boolean().default(false),
  mailforgeDomainId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Domain = z.infer<typeof domainSchema>;

export const connectDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Must be a valid domain'),
  purpose: z.enum(['primary', 'sending']).default('sending'),
});
export type ConnectDomainInput = z.infer<typeof connectDomainSchema>;

export const inboxConnectionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  domainId: z.string().optional(),
  provider: inboxProviderSchema,
  email: z.string().email(),
  displayName: z.string().optional(),
  status: inboxStatusSchema.default('connecting'),
  warmupEnabled: z.boolean().default(true),
  warmupStartDate: z.string().datetime().optional(),
  dailySendLimit: z.number().int().nonnegative().default(50),
  smtp: z
    .object({
      host: z.string(),
      port: z.number().int().positive(),
      user: z.string(),
      // Never persisted to Firestore in plaintext; stored encrypted at rest.
      password: z.string().optional(),
    })
    .optional(),
  imap: z
    .object({
      host: z.string(),
      port: z.number().int().positive().default(993),
      user: z.string(),
      // Never persisted to Firestore in plaintext; stored encrypted at rest.
      password: z.string().optional(),
    })
    .optional(),
  lastPolledAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InboxConnection = z.infer<typeof inboxConnectionSchema>;

export const connectInboxSchema = z
  .object({
    provider: inboxProviderSchema,
    // Optional: OAuth providers (gmail/yahoo) don't know the address until the
    // consent callback resolves it. smtp_imap must supply it up front — enforced
    // by the refine below. When present it must be a valid address.
    email: z.string().email().optional(),
    displayName: z.string().optional(),
    domainId: z.string().optional(),
    smtp: z
      .object({
        host: z.string(),
        port: z.number().int().positive(),
        user: z.string(),
        password: z.string(),
      })
      .optional(),
    imap: z
      .object({
        host: z.string(),
        port: z.number().int().positive().default(993),
        user: z.string(),
        password: z.string(),
      })
      .optional(),
  })
  .refine((v) => v.provider !== 'smtp_imap' || !!v.email, {
    message: 'email is required for smtp_imap inboxes',
    path: ['email'],
  });
export type ConnectInboxInput = z.infer<typeof connectInboxSchema>;
