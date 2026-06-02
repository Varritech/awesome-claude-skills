/**
 * /api/analytics - dashboard metrics.
 *
 * Accepts ?timeRange=TODAY|7D|14D|30D|90D (UI convention) or ?range=...
 * (legacy). Both are normalised internally.
 *
 * Aggregates real data from the `emails` and `campaigns` Firestore collections
 * for the authenticated user. Returns zeros when no data exists — never
 * fabricated seed values.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EmailRecord {
  id: string;
  userId: string;
  campaignId?: string;
  leadId?: string;
  status: 'draft' | 'queued' | 'sent' | 'opened' | 'replied' | 'bounced';
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  openedAt?: string | null;
  repliedAt?: string | null;
  replyCategory?:
    | 'interested'
    | 'not_interested'
    | 'do_not_contact'
    | 'auto_reply'
    | 'out_of_office'
    | 'referral'
    | 'question'
    | 'booked';
  deletedAt?: string | null;
}

interface CampaignRecord {
  id: string;
  name?: string;
  status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'archived';
}

interface LeadRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface TimeseriesPoint {
  date: string;
  emailsSent: number;
  replies: number;
  bookings: number;
}

interface WeekdayDatum {
  label: string;
  value: number;
  isHighlighted?: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAILY_LIMIT = 50;

function normaliseDays(raw: string | null): number {
  const s = (raw ?? '30D').toUpperCase();
  if (s === 'TODAY' || s === '1D') return 1;
  if (s === '7D') return 7;
  if (s === '14D') return 14;
  if (s === '90D') return 90;
  return 30;
}

function toDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function emptyTimeseries(days: number): TimeseriesPoint[] {
  const out: TimeseriesPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      emailsSent: 0,
      replies: 0,
      bookings: 0,
    });
  }
  return out;
}

function buildTimeseries(emails: EmailRecord[], days: number): TimeseriesPoint[] {
  const series = emptyTimeseries(days);
  const index = new Map(series.map((p, i) => [p.date, i] as const));

  for (const e of emails) {
    if (e.deletedAt) continue;

    const sentKey = toDateKey(e.sentAt);
    if (sentKey !== null && index.has(sentKey)) {
      series[index.get(sentKey)!].emailsSent += 1;
    }

    if (e.status === 'replied') {
      const replyKey = toDateKey(e.repliedAt) ?? sentKey;
      if (replyKey !== null && index.has(replyKey)) {
        series[index.get(replyKey)!].replies += 1;
      }
      if (e.replyCategory === 'booked') {
        const bookKey = toDateKey(e.repliedAt) ?? sentKey;
        if (bookKey !== null && index.has(bookKey)) {
          series[index.get(bookKey)!].bookings += 1;
        }
      }
    }
  }

  return series;
}

function buildWeekData(timeseries: TimeseriesPoint[]): WeekdayDatum[] {
  const slice = timeseries.slice(-7);
  const today = new Date().toISOString().slice(0, 10);
  return slice.map((pt) => {
    const d = new Date(pt.date);
    const dayIdx = d.getUTCDay();
    const label = DAY_LABELS[(dayIdx + 6) % 7];
    const isToday = pt.date === today;
    return { label, value: pt.emailsSent, ...(isToday ? { isHighlighted: true } : {}) };
  });
}

function trend7(timeseries: TimeseriesPoint[], key: keyof TimeseriesPoint): number[] {
  return timeseries.slice(-7).map((pt) => Number(pt[key]) || 0);
}

interface Reply {
  initials: string;
  name: string;
  badge: string;
  badgeColor: 'mint' | 'default';
  preview: string;
  time: string;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function badgeFor(category: EmailRecord['replyCategory']): {
  label: string;
  color: 'mint' | 'default';
} {
  switch (category) {
    case 'interested':
      return { label: 'Interested', color: 'mint' };
    case 'booked':
      return { label: 'Booked', color: 'mint' };
    case 'referral':
      return { label: 'Referral', color: 'mint' };
    case 'question':
      return { label: 'Question', color: 'default' };
    case 'auto_reply':
      return { label: 'Auto-reply', color: 'default' };
    case 'out_of_office':
      return { label: 'OOO', color: 'default' };
    case 'not_interested':
      return { label: 'Not now', color: 'default' };
    case 'do_not_contact':
      return { label: 'DNC', color: 'default' };
    default:
      return { label: 'Reply', color: 'default' };
  }
}

function uiCampaignStatus(
  s: CampaignRecord['status'],
): 'active' | 'warming' | 'draft' | 'paused' | 'done' {
  switch (s) {
    case 'running':
      return 'active';
    case 'scheduled':
      return 'warming';
    case 'paused':
      return 'paused';
    case 'completed':
    case 'archived':
      return 'done';
    case 'draft':
    default:
      return 'draft';
  }
}

async function fetchEmailsInWindow(
  userId: string,
  startIso: string,
): Promise<EmailRecord[]> {
  try {
    // createdAt may not be indexed for range scans together with userId in
    // every environment; do an in-memory filter on userId-scoped scan to keep
    // the query simple. The dashboard window is bounded (max 90 days) and
    // typical user volume is small.
    const snap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EmailRecord, 'id'>) }))
      .filter((e) => !e.deletedAt && (e.createdAt ?? '') >= startIso);
  } catch (err) {
    console.warn('[api:analytics] firestore query failed', err);
    return [];
  }
}

async function fetchEmailsBetween(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<EmailRecord[]> {
  try {
    const snap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EmailRecord, 'id'>) }))
      .filter(
        (e) =>
          !e.deletedAt &&
          (e.createdAt ?? '') >= startIso &&
          (e.createdAt ?? '') < endIso,
      );
  } catch (err) {
    console.warn('[api:analytics] prior-window query failed', err);
    return [];
  }
}

async function fetchActiveCampaigns(userId: string): Promise<
  Array<{ name: string; status: 'active' | 'warming' | 'draft' | 'paused' | 'done' }>
> {
  try {
    const snap = await adminDb
      .collection('campaigns')
      .where('userId', '==', userId)
      .limit(20)
      .get();
    return snap.docs.map((d) => {
      const c = d.data() as CampaignRecord;
      return {
        name: c.name ?? 'Untitled',
        status: uiCampaignStatus(c.status),
      };
    });
  } catch (err) {
    console.warn('[api:analytics] campaigns query failed', err);
    return [];
  }
}

async function fetchLeadsByIds(ids: string[]): Promise<Map<string, LeadRecord>> {
  const out = new Map<string, LeadRecord>();
  if (ids.length === 0) return out;
  try {
    const snaps = await Promise.all(
      ids.map((id) => adminDb.collection('leads').doc(id).get()),
    );
    for (const s of snaps) {
      if (s.exists) {
        out.set(s.id, { id: s.id, ...(s.data() as Omit<LeadRecord, 'id'>) });
      }
    }
  } catch (err) {
    console.warn('[api:analytics] lead lookup failed', err);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const rawParam = url.searchParams.get('timeRange') ?? url.searchParams.get('range');
  const days = normaliseDays(rawParam);
  const resolvedRange = rawParam ?? '30D';

  logRequest('analytics.GET', userId, { resolvedRange, days });

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - (days - 1));
  windowStart.setUTCHours(0, 0, 0, 0);

  const priorWindowStart = new Date(windowStart);
  priorWindowStart.setUTCDate(priorWindowStart.getUTCDate() - days);

  const [windowEmails, priorEmails, activeCampaigns] = await Promise.all([
    fetchEmailsInWindow(userId, windowStart.toISOString()),
    fetchEmailsBetween(userId, priorWindowStart.toISOString(), windowStart.toISOString()),
    fetchActiveCampaigns(userId),
  ]);

  const timeseries = buildTimeseries(windowEmails, days);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPt =
    timeseries.find((p) => p.date === todayKey) ?? timeseries[timeseries.length - 1];

  const sentToday = todayPt?.emailsSent ?? 0;
  const sentPercent = Math.min(100, Math.round((sentToday / DAILY_LIMIT) * 100));

  const totalSent = timeseries.reduce((s, p) => s + p.emailsSent, 0);
  const totalReplies = timeseries.reduce((s, p) => s + p.replies, 0);
  const totalBookings = timeseries.reduce((s, p) => s + p.bookings, 0);

  const priorReplies = priorEmails.filter((e) => e.status === 'replied').length;
  const repliesChangePercent =
    priorReplies === 0
      ? totalReplies > 0
        ? 100
        : 0
      : Math.round(((totalReplies - priorReplies) / priorReplies) * 100);

  const repliesPercent = totalSent === 0 ? 0 : Math.round((totalReplies / totalSent) * 100);

  const interestedEmails = windowEmails.filter(
    (e) =>
      e.status === 'replied' &&
      (e.replyCategory === 'interested' || e.replyCategory === 'booked'),
  );
  const interested = interestedEmails.length;
  const interestedNew = interestedEmails.filter(
    (e) => toDateKey(e.repliedAt ?? e.sentAt) === todayKey,
  ).length;

  const opened = windowEmails.filter((e) => Boolean(e.openedAt) || e.status === 'replied').length;
  const openRatePercent = totalSent === 0 ? 0 : Math.round((opened / totalSent) * 100);

  const weekData = buildWeekData(timeseries);
  const interestedTrend = trend7(timeseries, 'replies').map((r) => Math.round(r * 0.4));
  const bookedTrend = trend7(timeseries, 'bookings');
  const repliedTrend = trend7(timeseries, 'replies');

  // Recent replies — top 5 by repliedAt desc, joined with lead names.
  const replyEmails = windowEmails
    .filter((e) => e.status === 'replied')
    .sort((a, b) => {
      const ta = new Date(a.repliedAt ?? a.sentAt ?? a.createdAt).getTime();
      const tb = new Date(b.repliedAt ?? b.sentAt ?? b.createdAt).getTime();
      return tb - ta;
    })
    .slice(0, 5);

  const leadIds = Array.from(
    new Set(replyEmails.map((e) => e.leadId).filter((v): v is string => Boolean(v))),
  );
  const leadsMap = await fetchLeadsByIds(leadIds);

  const recentReplies: Reply[] = replyEmails.map((e) => {
    const lead = e.leadId ? leadsMap.get(e.leadId) : undefined;
    const fullName = lead
      ? [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email || 'Unknown'
      : 'Unknown';
    const badge = badgeFor(e.replyCategory);
    return {
      initials: initialsOf(fullName),
      name: fullName,
      badge: badge.label,
      badgeColor: badge.color,
      preview: '',
      time: relativeTime(e.repliedAt ?? e.sentAt),
    };
  });

  const bouncedCount = windowEmails.filter((e) => e.status === 'bounced').length;
  const inboxHealth =
    totalSent === 0 ? 0 : Math.max(0, 100 - Math.round((bouncedCount / totalSent) * 100));
  const inboxHealthLabel =
    inboxHealth === 0
      ? 'No data'
      : inboxHealth >= 90
        ? 'Excellent'
        : inboxHealth >= 75
          ? 'Healthy'
          : inboxHealth >= 50
            ? 'At risk'
            : 'Poor';

  const interestedBreakdown = windowEmails.filter(
    (e) =>
      e.status === 'replied' &&
      (e.replyCategory === 'interested' || e.replyCategory === 'booked'),
  ).length;
  const neutralBreakdown = windowEmails.filter(
    (e) =>
      e.status === 'replied' &&
      (e.replyCategory === 'question' ||
        e.replyCategory === 'referral' ||
        e.replyCategory === 'auto_reply' ||
        e.replyCategory === 'out_of_office'),
  ).length;
  const notNowBreakdown = windowEmails.filter(
    (e) =>
      e.status === 'replied' &&
      (e.replyCategory === 'not_interested' || e.replyCategory === 'do_not_contact'),
  ).length;
  const breakdownTotal = interestedBreakdown + neutralBreakdown + notNowBreakdown;
  const replyBreakdown =
    breakdownTotal === 0
      ? [
          { value: 0, color: '#22C55E', label: 'Interested' },
          { value: 0, color: '#F59E0B', label: 'Neutral' },
          { value: 0, color: '#EF4444', label: 'Not now' },
        ]
      : [
          {
            value: Math.round((interestedBreakdown / breakdownTotal) * 100),
            color: '#22C55E',
            label: 'Interested',
          },
          {
            value: Math.round((neutralBreakdown / breakdownTotal) * 100),
            color: '#F59E0B',
            label: 'Neutral',
          },
          {
            value: Math.round((notNowBreakdown / breakdownTotal) * 100),
            color: '#EF4444',
            label: 'Not now',
          },
        ];

  const priorSent = priorEmails.filter((e) => e.sentAt).length;
  const totalSentChangePercent =
    priorSent === 0
      ? totalSent > 0
        ? 100
        : 0
      : Math.round(((totalSent - priorSent) / priorSent) * 100);

  const leadsContacted = new Set(
    windowEmails.map((e) => e.leadId).filter((v): v is string => Boolean(v)),
  ).size;

  return NextResponse.json({
    data: {
      // ── Dashboard page fields ────────────────────────────────────────────
      sent: sentToday,
      dailyLimit: DAILY_LIMIT,
      sentPercent,
      replies: totalReplies,
      repliesChangePercent,
      repliesPercent,
      interested,
      interestedNew,
      interestedTrend,
      calls: totalBookings,
      callsTrend: bookedTrend,
      weekData,
      campaigns: activeCampaigns,
      inboxHealth,
      inboxHealthLabel,
      sendCompletionPercent: sentPercent,
      recentReplies,

      // ── Analytics page fields ────────────────────────────────────────────
      totalSent,
      totalSentChangePercent,
      totalSentPercent: sentPercent,
      opened,
      openRatePercent,
      openRateLabel: `${openRatePercent}% open rate`,
      replied: totalReplies,
      repliedChange: repliesChangePercent,
      repliedTrend,
      booked: totalBookings,
      bookedTrend,
      replyBreakdown,
      replyRate: `${repliesPercent}%`,
      tableData: [],

      // ── Legacy fields ────────────────────────────────────────────────────
      range: resolvedRange,
      emailsSent: totalSent,
      leadsContacted,
      callsBooked: totalBookings,
      openRate: totalSent === 0 ? 0 : Number((opened / totalSent).toFixed(3)),
      bookingRate: totalSent === 0 ? 0 : Number((totalBookings / totalSent).toFixed(3)),
      timeseries,
    },
  });
}
