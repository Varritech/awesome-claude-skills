/**
 * GET /api/export/campaigns
 *
 * Streams a CSV of all the authenticated user's campaigns with stats.
 * Headers: id,name,status,sent,opened,replied,bounced,openRate,replyRate,createdAt
 */

import { requireUser, logRequest } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';
import { campaignsToCSV, type CampaignExportRow } from '@/lib/export/csv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('export.campaigns.GET', userId);

  const campaignSnap = await adminDb
    .collection('campaigns')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  const rows: CampaignExportRow[] = await Promise.all(
    campaignSnap.docs.map(async (d) => {
      const data = d.data();
      const campaignId = d.id;

      // Aggregate email stats for this campaign
      const emailSnap = await adminDb
        .collection('emails')
        .where('campaignId', '==', campaignId)
        .get();

      let sent = 0;
      let opened = 0;
      let replied = 0;
      let bounced = 0;

      emailSnap.docs.forEach((e) => {
        const ed = e.data();
        if (ed.status === 'sent' || ed.status === 'opened' || ed.status === 'replied') sent++;
        if (ed.openedAt) opened++;
        if (ed.repliedAt) replied++;
        if (ed.status === 'bounced') bounced++;
      });

      const openRate = sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : '0%';
      const replyRate = sent > 0 ? `${((replied / sent) * 100).toFixed(1)}%` : '0%';

      return {
        id: campaignId,
        name: data.name ?? '',
        status: data.status ?? '',
        sent,
        opened,
        replied,
        bounced,
        openRate,
        replyRate,
        createdAt: data.createdAt,
      };
    }),
  );

  const csv = campaignsToCSV(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaigns-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
