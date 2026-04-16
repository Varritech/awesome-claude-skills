/**
 * /api/analytics - dashboard metrics.
 *
 * TODO: Replace with real aggregations once events are being written to
 * `analytics_events` (or similar). For now emits stable mock data so the
 * charts can be wired up against the final shape.
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

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '30d';
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  logRequest('analytics.GET', userId, { range });

  const timeseries = buildTimeseries(days);
  const emailsSent = timeseries.reduce((s, p) => s + p.emailsSent, 0);
  const replies = timeseries.reduce((s, p) => s + p.replies, 0);
  const bookings = timeseries.reduce((s, p) => s + p.bookings, 0);
  const leadsContacted = Math.round(emailsSent * 0.82);

  return NextResponse.json({
    data: {
      range,
      emailsSent,
      leadsContacted,
      callsBooked: bookings,
      openRate: emailsSent === 0 ? 0 : Number(((replies * 4.2) / emailsSent).toFixed(3)),
      replyRate: emailsSent === 0 ? 0 : Number((replies / emailsSent).toFixed(3)),
      bookingRate: emailsSent === 0 ? 0 : Number((bookings / emailsSent).toFixed(3)),
      timeseries,
    },
  });
}
