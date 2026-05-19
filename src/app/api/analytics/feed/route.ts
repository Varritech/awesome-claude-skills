/**
 * GET /api/analytics/feed
 *
 * Returns the last 50 email events ordered by time desc.
 * Events: sent | opened | replied | bounced
 *
 * Shape: { events: [{ type, leadName, campaignName, timestamp }] }
 */

import { NextResponse } from 'next/server';
import { requireUser, logRequest } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('analytics.feed.GET', userId);

  // Query last 50 emails with activity (opened, replied, bounced, or recently sent)
  const snap = await adminDb
    .collection('emails')
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();

  // Fetch campaign names in parallel (deduplicated)
  const campaignIds = Array.from(new Set(snap.docs.map((d) => d.data().campaignId).filter(Boolean)));
  const leadIds = Array.from(new Set(snap.docs.map((d) => d.data().leadId).filter(Boolean)));

  const [campaignDocs, leadDocs] = await Promise.all([
    campaignIds.length > 0
      ? Promise.all(campaignIds.map((id) => adminDb.collection('campaigns').doc(id as string).get()))
      : Promise.resolve([]),
    leadIds.length > 0
      ? Promise.all(leadIds.map((id) => adminDb.collection('leads').doc(id as string).get()))
      : Promise.resolve([]),
  ]);

  const campaignMap = Object.fromEntries(
    campaignDocs.filter((d) => d.exists).map((d) => [d.id, d.data()?.name ?? 'Unknown Campaign']),
  );
  const leadMap = Object.fromEntries(
    leadDocs.filter((d) => d.exists).map((d) => {
      const data = d.data()!;
      const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email || 'Unknown';
      return [d.id, name];
    }),
  );

  type EventType = 'sent' | 'opened' | 'replied' | 'bounced';

  // Build event list: one event per email (most recent event type)
  const events = snap.docs.map((d) => {
    const data = d.data();
    let type: EventType = 'sent';
    let timestamp = data.sentAt ?? data.updatedAt ?? data.createdAt;

    if (data.repliedAt) {
      type = 'replied';
      timestamp = data.repliedAt;
    } else if (data.openedAt) {
      type = 'opened';
      timestamp = data.openedAt;
    } else if (data.status === 'bounced') {
      type = 'bounced';
      timestamp = data.updatedAt ?? data.sentAt;
    }

    return {
      type,
      leadName: data.leadId ? (leadMap[data.leadId] ?? 'Unknown') : 'Unknown',
      campaignName: data.campaignId ? (campaignMap[data.campaignId] ?? 'Unknown Campaign') : 'Unknown Campaign',
      timestamp,
    };
  });

  // Sort by timestamp desc
  events.sort((a, b) => {
    const ta = a.timestamp ?? '';
    const tb = b.timestamp ?? '';
    return tb.localeCompare(ta);
  });

  return NextResponse.json({ data: { events } });
}
