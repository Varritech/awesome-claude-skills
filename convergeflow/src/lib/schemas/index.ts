/**
 * Barrel file for all Zod schemas.
 *
 * Prefer importing directly from the per-entity files
 * (`@/lib/schemas/campaign`, etc.) for tree-shaking, but this barrel keeps
 * legacy imports from `@/lib/schemas` working.
 */

import { z } from 'zod';
import { subscriptionTierSchema } from './user';

export * from './user';
export * from './campaign';
export * from './lead';
export * from './domain';

/* Personas (custom user-defined personas, separate from the persona preset enum) */

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(4000),
  tone: z
    .enum(['direct', 'warm', 'expert', 'friendly', 'irreverent'])
    .default('direct'),
});
export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;

/* Billing */

/**
 * Plan-ID aliases sent by the UI (payments page uses planId, not tier).
 * Both forms are accepted; the checkout route normalises to tier internally.
 */
const planIdSchema = z.enum(['starter', 'pro', 'scale']);

export const checkoutSchema = z
  .object({
    /** Internal tier name (legacy / server-side callers). */
    tier: subscriptionTierSchema.optional(),
    /** UI-facing plan id: "starter" | "pro" | "scale". */
    planId: planIdSchema.optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .refine((d) => d.tier || d.planId, {
    message: 'Either tier or planId is required',
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;
