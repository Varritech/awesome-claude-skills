/**
 * Barrel file for all Zod schemas.
 *
 * Prefer importing directly from the per-entity files
 * (`@/lib/schemas/campaign`, etc.) for tree-shaking, but this barrel keeps
 * legacy imports from `@/lib/schemas` working.
 */

import { z } from "zod";
import { subscriptionTierSchema } from "./user";

export * from "./user";
export * from "./campaign";
export * from "./lead";
export * from "./domain";
export * from "./sequence";

/* Personas (custom user-defined personas, separate from the persona preset enum) */

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(4000),
  tone: z.enum(["direct", "warm", "expert", "friendly", "irreverent"]).default("direct"),
});
export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;

/* Billing */

export const checkoutSchema = z.object({
  tier: subscriptionTierSchema,
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
