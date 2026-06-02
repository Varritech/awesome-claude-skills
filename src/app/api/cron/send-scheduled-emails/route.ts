/**
 * GET /api/cron/send-scheduled-emails
 *
 * Called every 15 minutes by Vercel Cron (see vercel.json).
 * Finds emails with status="queued" and scheduledFor<=now, then fires one
 * email/send Inngest event per email. The send-email function handles SMTP,
 * warmup quota, and any tomorrow-requeue logic.
 *
 * Each batch is capped at 500 to stay well under Inngest event-batch limits.
 * Secured by CRON_SECRET header (set in Vercel env).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';
import { buildSendEvents, type QueuedEmail } from '@/lib/emails/send-scheduled';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 500;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    const snap = await adminDb
      .collection('emails')
      .where('status', '==', 'queued')
      .where('scheduledFor', '<=', nowIso)
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) {
      return NextResponse.json({ data: { fired: 0, skippedNoInbox: 0 } });
    }

    const queued: QueuedEmail[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<QueuedEmail, 'id'>),
    }));

    const { events, skippedNoInbox } = await buildSendEvents(queued, async (userId) => {
      const inboxSnap = await adminDb
        .collection('inboxes')
        .where('userId', '==', userId)
        .where('status', 'in', ['warming', 'active'])
        .limit(1)
        .get();
      return inboxSnap.empty ? null : inboxSnap.docs[0].id;
    });

    if (events.length > 0) {
      await inngest.send(events);
    }

    console.info(`[cron:send-scheduled-emails] fired ${events.length} email/send events, skipped ${skippedNoInbox}`);
    return NextResponse.json({ data: { fired: events.length, skippedNoInbox } });
  } catch (err) {
    console.error('[cron:send-scheduled-emails]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
