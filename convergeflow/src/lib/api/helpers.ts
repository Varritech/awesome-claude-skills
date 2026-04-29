/**
 * Shared helpers for API route handlers.
 *
 * - `requireUser()` calls Clerk's `auth()` and returns the userId, otherwise
 *   returns a 401 NextResponse that the route can early-return.
 * - `jsonError()` standardises error payloads.
 * - `parseJson()` safely decodes a JSON body.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';

export type UserResult =
  | { userId: string; response?: undefined }
  | { userId?: undefined; response: NextResponse };

export async function requireUser(): Promise<UserResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { userId };
}

export function jsonError(message: string, status = 500, details?: unknown) {
  const payload: Record<string, unknown> = { error: message };
  if (details !== undefined) payload.details = details;
  return NextResponse.json(payload, { status });
}

export async function parseJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function parseAndValidate<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T; response?: undefined } | { data?: undefined; response: NextResponse }> {
  const raw = await parseJson<unknown>(req);
  if (raw === null) {
    return { response: jsonError('Invalid JSON body', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: jsonError('Validation failed', 400, parsed.error.flatten()),
    };
  }
  return { data: parsed.data };
}

export function logRequest(route: string, userId: string, extra?: unknown) {
  console.info(`[api:${route}]`, { userId, ...(extra ? { extra } : {}) });
}
