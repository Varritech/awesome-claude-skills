/**
 * Real analytics aggregator — queries Firestore for actual email metrics.
 *
 * Replaces the mock buildTimeseries() in /api/analytics. All functions accept
 * a userId and date window, query the emails collection, and return typed
 * aggregates. Falls back to empty/zero values when Firestore returns nothing
 * (new users with no data).
 */

import { adminDb } from '@/lib/firebase/admin';
import type { ReplyCategory } from '@/lib/schemas/campaign';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  date: string;
  emailsSent: number;
  replies: number;
  bookings: number;
}

export interface ReplyBreakdown {
  interested: number;
  booked: number;
  question: number;
  not_interested: number;
  auto_reply: number;
}

export interface RecentReply {
  initials: string;
  name: string;
  badge: string;
  badgeColor: 'mint' | 'default';
  preview: string;
  time: string;
}

export interface CampaignStatus {
  name: string;
  status: 'active' | 'warming' | 'draft' | 'paused' | 'done';
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Build a timeseries of email activity for the given date window.
 * Queries the emails collection and buckets by date.
 */
export async function getTimeseriesData(
  userId: string,
  days: number,
): Promise<TimeseriesPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  try {
    const snap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .where('sentAt', '>=', startDate.toISOString())
      .get();

    // Initialize buckets
    const buckets = new Map<string, TimeseriesPoint>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, emailsSent: 0, replies: 0, bookings: 0 });
    }

    // Fill from real data
    for (const doc of snap.docs) {
      const data = doc.data();
      const sentDate = data.sentAt
        ? new Date(data.sentAt).toISOString().slice(0, 10)
        : null;
      const repliedDate = data.repliedAt
        ? new Date(data.repliedAt).toISOString().slice(0, 10)
        : null;

      if (sentDate && buckets.has(sentDate)) {
        buckets.get(sentDate)!.emailsSent++;
      }
      if (repliedDate && buckets.has(repliedDate)) {
        buckets.get(repliedDate)!.replies++;
        if (data.replyCategory === 'booked') {
          buckets.get(repliedDate)!.bookings++;
        }
      }
    }

    // Return sorted by date ascending
    return Array.from(buckets.values()).sort(
      (a, b) => a.date.localeCompare(b.date),
    );
  } catch (err) {
    console.warn('[analytics:getTimeseriesData] query failed', err);
    return [];
  }
}

/**
 * Get the reply category breakdown for the given date window.
 */
export async function getReplyBreakdown(
  userId: string,
  days: number,
): Promise<ReplyBreakdown> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  const breakdown: ReplyBreakdown = {
    interested: 0,
    booked: 0,
    question: 0,
    not_interested: 0,
    auto_reply: 0,
  };

  try {
    const snap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .where('repliedAt', '>=', startDate.toISOString())
      .get();

    for (const doc of snap.docs) {
      const category = doc.data().replyCategory as ReplyCategory | undefined;
      if (category && category in breakdown) {
        breakdown[category as keyof ReplyBreakdown]++;
      }
    }
  } catch (err) {
    console.warn('[analytics:getReplyBreakdown] query failed', err);
  }

  return breakdown;
}

/**
 * Get recent replies for the dashboard "Recent Replies" widget.
 */
export async function getRecentReplies(
  userId: string,
  limit = 5,
): Promise<RecentReply[]> {
  try {
    const snap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .where('status', '==', 'replied')
      .orderBy('repliedAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      const category = (data.replyCategory as ReplyCategory) ?? 'question';
      const replyText = (data.replyText as string) ?? '';
      const fromEmail = (data.replyFromEmail as string) ?? '';
      const repliedAt = data.repliedAt as string | undefined;

      const name = fromEmail.split('@')[0] ?? 'Unknown';
      const initials = name
        .split(/[._-]/)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);

      return {
        initials: initials || '?',
        name: name || 'Unknown',
        badge: categoryLabel(category),
        badgeColor: categoryBadgeColor(category),
        preview: replyText.slice(0, 80),
        time: repliedAt ? formatRelativeTime(repliedAt) : '',
      };
    });
  } catch (err) {
    console.warn('[analytics:getRecentReplies] query failed', err);
    return [];
  }
}

/**
 * Get active campaigns for the dashboard status widget.
 */
export async function getCampaignStatuses(
  userId: string,
): Promise<CampaignStatus[]> {
  try {
    const snap = await adminDb
      .collection('campaigns')
      .where('userId', '==', userId)
      .where('status', 'in', ['running', 'scheduled', 'draft', 'paused'])
      .limit(10)
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        name: data.name ?? 'Untitled',
        status: campaignStatusToUi(data.status),
      };
    });
  } catch (err) {
    console.warn('[analytics:getCampaignStatuses] query failed', err);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryLabel(category: ReplyCategory): string {
  const labels: Record<ReplyCategory, string> = {
    interested: 'Interested',
    booked: 'Booked',
    question: 'Question',
    not_interested: 'Not Interested',
    auto_reply: 'Auto Reply',
  };
  return labels[category];
}

function categoryBadgeColor(category: ReplyCategory): 'mint' | 'default' {
  if (category === 'interested' || category === 'booked') return 'mint';
  return 'default';
}

function campaignStatusToUi(
  status: string,
): CampaignStatus['status'] {
  switch (status) {
    case 'running':
      return 'active';
    case 'scheduled':
      return 'draft';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'done';
    default:
      return 'draft';
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
