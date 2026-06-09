/**
 * /api/emails/auto-draft
 *
 * POST — idempotent per send window. Drafts up to 20 outreach emails for the
 * caller, queuing each for the next 8 AM UTC window. The drafting logic lives
 * in `lib/emails/draft-for-user` so the daily cron uses the same code path.
 *
 * Safe to call on every dashboard mount; the helper exits early when drafts
 * for the same window already exist.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';
import { draftEmailsForUser } from '@/lib/emails/draft-for-user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('emails.auto-draft.POST', userId, {});

  const result = await draftEmailsForUser(adminDb, userId);
  return NextResponse.json(result);
}
