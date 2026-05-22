/**
 * GET /api/deliverability/recommendations
 *
 * Returns deliverability recommendations for the authenticated user's inboxes.
 */

import { NextResponse } from 'next/server';
import { logRequest, requireUser } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';
import { getRecommendations, type DeliverabilityMetrics } from '@/lib/deliverability/recommendations';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('deliverability.recommendations.GET', userId);

  // Load inboxes to derive metrics
  const inboxSnap = await adminDb
    .collection('inboxes')
    .where('userId', '==', userId)
    .limit(20)
    .get();

  const inboxDocs = inboxSnap.docs.map((d) => d.data());

  // Aggregate metrics across all inboxes
  const inboxCount = inboxDocs.length;
  const bounceRates = inboxDocs.map((d) => (d.bounceRate as number) ?? 0);
  const complaintRates = inboxDocs.map((d) => (d.complaintRate as number) ?? 0);
  const avgBounceRate = inboxCount > 0 ? bounceRates.reduce((a, b) => a + b, 0) / inboxCount : 0;
  const avgComplaintRate = inboxCount > 0 ? complaintRates.reduce((a, b) => a + b, 0) / inboxCount : 0;

  const hasSpf = inboxDocs.length === 0 || inboxDocs.every((d) => d.spf === true);
  const hasDkim = inboxDocs.length === 0 || inboxDocs.every((d) => d.dkim === true);
  const hasDmarc = inboxDocs.length === 0 || inboxDocs.every((d) => d.dmarc === true);

  // Warmup percent: average across inboxes (warmupPercent field, or 100 if active)
  const warmupPercents = inboxDocs.map((d) => {
    if (d.status === 'active') return 100;
    return (d.warmupPercent as number) ?? 0;
  });
  const warmupPercent = inboxCount > 0
    ? Math.round(warmupPercents.reduce((a, b) => a + b, 0) / inboxCount)
    : 100;

  // Load domain from user profile
  const userSnap = await adminDb.collection('users').doc(userId).get();
  const domain = (userSnap.data()?.domain as string) ?? undefined;

  const metrics: DeliverabilityMetrics = {
    bounceRate: avgBounceRate,
    complaintRate: avgComplaintRate,
    hasDkim,
    hasSpf,
    hasDmarc,
    warmupPercent,
    domain,
    inboxCount,
  };

  const recommendations = getRecommendations(metrics);

  return NextResponse.json({ data: { recommendations } });
}
