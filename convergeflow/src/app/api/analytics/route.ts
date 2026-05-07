/**
 * /api/analytics - dashboard metrics.
 *
 * Accepts ?timeRange=7D|14D|30D|90D (UI convention) or ?range=7d|30d|90d
 * (legacy). Both are normalised internally.
 *
 * Returns a combined shape that satisfies both the dashboard page and the
 * analytics page – the api-client unwraps the { data: T } envelope, so pages
 * receive the inner object directly.
 *
 * TODO: Replace with real aggregations once analytics_events are live.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

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

function normaliseDays(raw: string | null): number {
  // Accept 7D/7d, 14D/14d, 30D/30d, 90D/90d; also "today" → 1 day bucket
  const s = (raw ?? '30D').toUpperCase();
  if (s === 'TODAY' || s === '1D') return 1;
  if (s === '7D') return 7;
  if (s === '14D') return 14;
  if (s === '90D') return 90;
  return 30; // default
}

function buildTimeseries(days: number): TimeseriesPoint[] {
  const out: TimeseriesPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const seed = d.getDate();
    out.push({
      date: d.toISOString().slice(0, 10),
      emailsSent: 18 + ((seed * 7) % 22),
      replies: 1 + (seed % 4),
      bookings: seed % 3 === 0 ? 1 : 0,
    });
  }
  return out;
}

function buildWeekData(timeseries: TimeseriesPoint[]): WeekdayDatum[] {
  // Aggregate by day-of-week label for the bar chart, last 7 slices max
  const slice = timeseries.slice(-7);
  const today = new Date();
  return slice.map((pt) => {
    const d = new Date(pt.date);
    const dayIdx = d.getDay(); // 0=Sun
    // Convert 0=Sun to Mon-indexed: Sun→6, Mon→0 … Sat→5
    const label = DAY_LABELS[(dayIdx + 6) % 7];
    const isToday = pt.date === today.toISOString().slice(0, 10);
    return { label, value: pt.emailsSent, ...(isToday ? { isHighlighted: true } : {}) };
  });
}

function buildTrend7(timeseries: TimeseriesPoint[], key: keyof TimeseriesPoint): number[] {
  return timeseries.slice(-7).map((pt) => pt[key] as number);
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  // Support both ?timeRange= (UI) and ?range= (legacy), case-insensitive
  const rawParam = url.searchParams.get('timeRange') ?? url.searchParams.get('range');
  const days = normaliseDays(rawParam);
  const resolvedRange = rawParam ?? '30D';

  logRequest('analytics.GET', userId, { resolvedRange, days });

  const timeseries = buildTimeseries(days);
  const totalSent = timeseries.reduce((s, p) => s + p.emailsSent, 0);
  const totalReplies = timeseries.reduce((s, p) => s + p.replies, 0);
  const totalBookings = timeseries.reduce((s, p) => s + p.bookings, 0);

  // Today slice (last point) for dashboard "today" figures
  const todayPt = timeseries[timeseries.length - 1];
  const sentToday = todayPt?.emailsSent ?? 0;
  const DAILY_LIMIT = 50;
  const sentPercent = Math.min(100, Math.round((sentToday / DAILY_LIMIT) * 100));

  // Derived metrics
  const repliesPercent = totalSent === 0 ? 0 : Math.round((totalReplies / totalSent) * 100);
  const interested = Math.round(totalReplies * 0.4);
  const openRatePercent = 38;
  const opened = Math.round(totalSent * 0.38);

  const weekData = buildWeekData(timeseries);
  const interestedTrend = buildTrend7(timeseries, 'replies').map((r) => Math.round(r * 0.4));
  const bookedTrend = buildTrend7(timeseries, 'bookings');
  const repliedTrend = buildTrend7(timeseries, 'replies');

  const replyRateStr = `${repliesPercent}%`;

  return NextResponse.json({
    data: {
      // ── Dashboard page fields ────────────────────────────────────────────
      sent: sentToday,
      dailyLimit: DAILY_LIMIT,
      sentPercent,
      replies: totalReplies,
      repliesChangePercent: 3,
      repliesPercent,
      interested,
      interestedNew: Math.max(1, Math.round(interested * 0.15)),
      interestedTrend,
      calls: totalBookings,
      callsTrend: bookedTrend,
      weekData,
      campaigns: [],
      inboxHealth: 85,
      inboxHealthLabel: 'Healthy',
      sendCompletionPercent: sentPercent,
      recentReplies: [],

      // ── Analytics page fields ────────────────────────────────────────────
      totalSent,
      totalSentChangePercent: 5,
      totalSentPercent: sentPercent,
      opened,
      openRatePercent,
      openRateLabel: `${openRatePercent}% open rate`,
      replied: totalReplies,
      repliedChange: 2,
      repliedTrend,
      booked: totalBookings,
      bookedTrend,
      replyBreakdown: [
        { value: 60, color: '#22C55E', label: 'Interested' },
        { value: 25, color: '#F59E0B', label: 'Neutral' },
        { value: 15, color: '#EF4444', label: 'Not now' },
      ],
      replyRate: replyRateStr,
      tableData: [],

      // ── Legacy fields (kept for backwards compat) ────────────────────────
      range: resolvedRange,
      emailsSent: totalSent,
      leadsContacted: Math.round(totalSent * 0.82),
      callsBooked: totalBookings,
      openRate: totalSent === 0 ? 0 : Number(((totalReplies * 4.2) / totalSent).toFixed(3)),
      bookingRate: totalSent === 0 ? 0 : Number((totalBookings / totalSent).toFixed(3)),
      timeseries,
    },
  });
}
