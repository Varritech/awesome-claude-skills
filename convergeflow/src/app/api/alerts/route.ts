/**
 * GET /api/alerts
 *
 * Returns unread deliverability alerts for the authenticated user.
 * Alerts are written by the bounce-monitor Inngest cron function.
 */

import { NextResponse } from 'next/server';
import { logRequest, requireUser } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('alerts.GET', userId);

  const snap = await adminDb
    .collection('alerts')
    .where('userId', '==', userId)
    .where('read', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ data: { alerts } });
}

/**
 * POST /api/alerts/:id/read  — not implemented here; handled inline by clients
 * via PATCH. This file only exposes the GET list.
 */
