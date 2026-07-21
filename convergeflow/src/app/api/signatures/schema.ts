/**
 * Signatures API schema + types.
 *
 * Kept out of route.ts so the route file only exports Next.js-recognized
 * route handlers (GET/POST) and route config — exporting a Zod schema or
 * interface from a route file is rejected by `next build`.
 */

import { z } from 'zod';

export const createSignatureSchema = z.object({
  name: z.string().min(1).max(80),
  html: z.string().min(1).max(10000),
  isDefault: z.boolean().default(false),
});

export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;

export interface SignatureRecord {
  id: string;
  userId: string;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}