/**
 * GET /api/cron/send-scheduled-emails
 *
 * Called every 15 minutes by Vercel Cron (see vercel.json).
 * Finds queued emails whose scheduledFor <= now, then dispatches each via SMTP
 * inline. No external broker dependency. Per-inbox throttling is enforced by
 * sleeping 1 second between sends with the same inboxId.
 *
 * Secured by CRON_SECRET header (set in Vercel env). When CRON_SECRET is unset,
 * the route is open (useful for local + preview testing).
 *
 * Vercel serverless functions have a 60s default budget on hobby and 300s on
 * pro plans. With a 1s throttle that bounds per-tick throughput to ~60-300
 * sends per inbox group; the next tick (15 min later) picks up the remainder.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { dispatchEmail, type DispatchOutcome } from '@/lib/emails/dispatch';
import { resolveInboxForEmails, type QueuedEmail } from '@/lib/emails/resolve-inbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds — needs Vercel Pro

const BATCH_LIMIT = 500;
const PER_INBOX_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SummaryCounts {
  sent: number;
  bounced: number;
  requeued: number;
  skipped: number;
  errored: number;
  skippedNoInbox: number;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const counts: SummaryCounts = {
    sent: 0,
    bounced: 0,
    requeued: 0,
    skipped: 0,
    errored: 0,
    skippedNoInbox: 0,
  };

  try {
    const nowIso = new Date().toISOString();
    const snap = await adminDb
      .collection('emails')
      .where('status', '==', 'queued')
      .where('scheduledFor', '<=', nowIso)
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) {
      return NextResponse.json({ data: { ...counts, total: 0 } });
    }

    const queued: QueuedEmail[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<QueuedEmail, 'id'>),
    }));

    // Best-effort: for emails missing inboxId, resolve and persist the user's
    // active inbox so the dispatcher has what it needs. resolveInboxForEmails
    // mutates each email in place and writes the inboxId back to Firestore.
    const { skippedNoInbox } = await resolveInboxForEmails(adminDb, queued);
    counts.skippedNoInbox = skippedNoInbox;

    // Group by inboxId so we can serialize sends within a single inbox group
    // (per-inbox throttle) while parallelizing across groups.
    const groups = new Map<string, QueuedEmail[]>();
    for (const e of queued) {
      if (!e.inboxId) continue; // resolveInboxForEmails already counted these as skipped
      const list = groups.get(e.inboxId) ?? [];
      list.push(e);
      groups.set(e.inboxId, list);
    }

    await Promise.all(
      Array.from(groups.values()).map(async (group) => {
        for (let i = 0; i < group.length; i++) {
          const email = group[i]!;
          try {
            const outcome = await dispatchEmail(adminDb, email.id);
            tally(counts, outcome);
          } catch (err) {
            console.error(`[cron:send-scheduled-emails] dispatch threw for ${email.id}`, err);
            counts.errored++;
          }
          if (i < group.length - 1) {
            await sleep(PER_INBOX_DELAY_MS);
          }
        }
      }),
    );

    console.info(
      `[cron:send-scheduled-emails] sent=${counts.sent} bounced=${counts.bounced} requeued=${counts.requeued} skipped=${counts.skipped} errored=${counts.errored} skippedNoInbox=${counts.skippedNoInbox}`,
    );
    return NextResponse.json({ data: { ...counts, total: queued.length } });
  } catch (err) {
    console.error('[cron:send-scheduled-emails]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function tally(counts: SummaryCounts, outcome: DispatchOutcome): void {
  switch (outcome.kind) {
    case 'sent':
      counts.sent++;
      break;
    case 'bounced':
      counts.bounced++;
      break;
    case 'requeued':
      counts.requeued++;
      break;
    case 'skipped':
      counts.skipped++;
      break;
  }
}
