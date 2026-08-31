/**
 * GET /api/cron/poll-replies
 *
 * Called every 2 minutes by Vercel Cron (see vercel.json).
 * Queries all active/warming inboxes with IMAP configured and fires
 * inbox/poll-replies events for each one.
 *
 * Secured by CRON_SECRET header (set in Vercel env).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Query all inboxes that are active/warming AND have IMAP configured
    const snap = await adminDb
      .collection('inboxes')
      .where('status', 'in', ['active', 'warming'])
      .get();

    if (snap.empty) {
      return NextResponse.json({ data: { fired: 0 } });
    }

    // Filter to only inboxes with IMAP configured (Firestore doesn't support
    // compound queries with existence checks, so we filter in memory)
    const events = snap.docs
      .filter((doc) => {
        const data = doc.data();
        return data.imapHost && data.imapUser && data.imapPasswordEncrypted;
      })
      .map((doc) => {
        const data = doc.data() as { userId: string };
        return {
          name: 'inbox/poll-replies' as const,
          data: { inboxId: doc.id, userId: data.userId },
        };
      });

    if (events.length > 0) {
      await inngest.send(events);
    }

    console.info(`[cron:poll-replies] fired ${events.length} poll-replies events`);
    return NextResponse.json({ data: { fired: events.length } });
  } catch (err) {
    console.error('[cron:poll-replies]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
