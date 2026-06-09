/**
 * GET /api/cron/auto-draft-daily
 *
 * Called daily by Vercel Cron (see vercel.json). Iterates every user with
 * onboardingCompleted=true and queues up to 20 cold-outreach drafts per user
 * for the next 8 AM UTC send window. The send cron at
 * /api/cron/send-scheduled-emails picks them up afterwards.
 *
 * Per-user drafting is delegated to draftEmailsForUser so the dashboard
 * /api/emails/auto-draft route and this cron share the same logic.
 *
 * Secured by CRON_SECRET header (set in Vercel env). When CRON_SECRET is
 * unset, the route is open (useful for local + preview testing).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { draftEmailsForUser, type DraftResult } from '@/lib/emails/draft-for-user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // seconds — Vercel Pro

interface UserDoc {
  onboardingCompleted?: boolean;
}

interface Tally {
  usersConsidered: number;
  usersDrafted: number;
  drafted: number;
  skipped: number;
  alreadyDrafted: number;
  noInbox: number;
  noLeads: number;
  errored: number;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tally: Tally = {
    usersConsidered: 0,
    usersDrafted: 0,
    drafted: 0,
    skipped: 0,
    alreadyDrafted: 0,
    noInbox: 0,
    noLeads: 0,
    errored: 0,
  };

  try {
    const snap = await adminDb
      .collection('users')
      .where('onboardingCompleted', '==', true)
      .get();

    if (snap.empty) {
      return NextResponse.json({ data: { ...tally, total: 0 } });
    }

    for (const doc of snap.docs) {
      tally.usersConsidered++;
      const userId = doc.id;
      const data = doc.data() as UserDoc;
      if (data.onboardingCompleted !== true) continue;

      try {
        const result: DraftResult = await draftEmailsForUser(adminDb, userId);
        tally.drafted += result.drafted;
        tally.skipped += result.skipped;
        if (result.alreadyDrafted) tally.alreadyDrafted++;
        if (result.noInbox) tally.noInbox++;
        if (result.noLeads) tally.noLeads++;
        if (result.drafted > 0) tally.usersDrafted++;
      } catch (err) {
        console.error(`[cron:auto-draft-daily] draft failed for ${userId}`, err);
        tally.errored++;
      }
    }

    console.info(
      `[cron:auto-draft-daily] usersConsidered=${tally.usersConsidered} usersDrafted=${tally.usersDrafted} drafted=${tally.drafted} skipped=${tally.skipped} alreadyDrafted=${tally.alreadyDrafted} noInbox=${tally.noInbox} noLeads=${tally.noLeads} errored=${tally.errored}`,
    );

    return NextResponse.json({ data: { ...tally, total: snap.size } });
  } catch (err) {
    console.error('[cron:auto-draft-daily]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
