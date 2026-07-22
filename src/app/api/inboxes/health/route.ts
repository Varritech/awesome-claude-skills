/**
 * GET /api/inboxes/health
 * Returns per-inbox health stats: warmup progress, quota usage, bounce rate, last send.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, logRequest } from '@/lib/api/helpers';
import { todayQuota } from '@/lib/warmup/scheduler';
import { warmupProgressPercent, statusBadge } from '@/lib/warmup/health';

export const dynamic = 'force-dynamic';

interface InboxRecord {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  provider: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
  warmupSentTotal?: number;
}

interface EmailStats {
  sentToday: number;
  bouncedTotal: number;
  sentTotal: number;
  lastSentAt?: string;
}

interface WarmupSendLogEntry {
  to: string;
  subject: string;
  sentAt: string;
}

interface InboxHealth {
  id: string;
  email: string;
  displayName?: string;
  provider: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  warmupSentTotal: number;
  recentWarmupSends: WarmupSendLogEntry[];
  warmupProgressPercent: number; // 0–100
  dailyQuotaUsed: number;
  dailyQuotaTotal: number;
  bounceRate: number; // 0–1
  lastSentAt?: string;
  statusBadge: 'healthy' | 'warming' | 'warning' | 'error';
}

async function getEmailStats(inboxId: string): Promise<EmailStats> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  try {
    const [sentTodaySnap, bouncedSnap, sentTotalSnap] = await Promise.all([
      adminDb
        .collection('emails')
        .where('inboxId', '==', inboxId)
        .where('status', '==', 'sent')
        .where('sentAt', '>=', startOfDay.toISOString())
        .get(),
      adminDb
        .collection('emails')
        .where('inboxId', '==', inboxId)
        .where('status', '==', 'bounced')
        .get(),
      adminDb
        .collection('emails')
        .where('inboxId', '==', inboxId)
        .where('status', '==', 'sent')
        .orderBy('sentAt', 'desc')
        .limit(1)
        .get(),
    ]);

    const lastSentDoc = sentTotalSnap.docs[0];
    const lastSentAt = lastSentDoc?.data()?.sentAt as string | undefined;

    // Count total sent (not just today) for bounce rate calculation
    const totalSentSnap = await adminDb
      .collection('emails')
      .where('inboxId', '==', inboxId)
      .where('status', 'in', ['sent', 'bounced'])
      .get();

    return {
      sentToday: sentTodaySnap.size,
      bouncedTotal: bouncedSnap.size,
      sentTotal: totalSentSnap.size,
      lastSentAt,
    };
  } catch {
    return { sentToday: 0, bouncedTotal: 0, sentTotal: 0 };
  }
}

/**
 * Recent warmup-send log entries (for the Inbox Health "warmup is happening"
 * visibility). Best-effort — returns [] if the subcollection is empty or
 * querying fails (e.g. missing composite index).
 */
async function getRecentWarmupSends(inboxId: string): Promise<WarmupSendLogEntry[]> {
  try {
    const snap = await adminDb
      .collection('inboxes')
      .doc(inboxId)
      .collection('warmupSends')
      .orderBy('sentAt', 'desc')
      .limit(10)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as { to: string; subject: string; sentAt: string };
      return { to: data.to, subject: data.subject, sentAt: data.sentAt };
    });
  } catch (err) {
    console.warn('[api:inboxes.health] warmupSends query failed', err);
    return [];
  }
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('inboxes.health.GET', userId);

  let inboxes: InboxRecord[] = [];

  try {
    const snap = await adminDb
      .collection('inboxes')
      .where('userId', '==', userId)
      .get();
    inboxes = snap.docs.map((d) => d.data() as InboxRecord);
  } catch (err) {
    console.warn('[api:inboxes.health] failed to load inboxes', err);
    return NextResponse.json({ data: [] });
  }

  const healthData = await Promise.all(
    inboxes.map(async (inbox): Promise<InboxHealth> => {
      const stats = await getEmailStats(inbox.id);
      const recentWarmupSends = await getRecentWarmupSends(inbox.id);
      const quota = todayQuota({
        warmupEnabled: inbox.warmupEnabled,
        warmupStartDate: inbox.warmupStartDate ?? null,
        dailySendLimit: inbox.dailySendLimit,
        status: inbox.status,
      });
      const bounceRate =
        stats.sentTotal > 0 ? stats.bouncedTotal / stats.sentTotal : 0;

      return {
        id: inbox.id,
        email: inbox.email,
        ...(inbox.displayName ? { displayName: inbox.displayName } : {}),
        provider: inbox.provider,
        status: inbox.status,
        warmupEnabled: inbox.warmupEnabled,
        warmupStartDate: inbox.warmupStartDate ?? null,
        warmupSentTotal: inbox.warmupSentTotal ?? 0,
        recentWarmupSends,
        warmupProgressPercent: warmupProgressPercent(inbox.warmupStartDate),
        dailyQuotaUsed: stats.sentToday,
        dailyQuotaTotal: quota,
        bounceRate,
        ...(stats.lastSentAt ? { lastSentAt: stats.lastSentAt } : {}),
        statusBadge: statusBadge(inbox.status, bounceRate),
      };
    }),
  );

  return NextResponse.json({ data: healthData });
}
