/**
 * Inngest function: bounce-monitor
 *
 * Daily cron: aggregates bounce rates per campaign per user.
 * If bounceRate > 5%, writes a high_bounce alert to the `alerts` collection.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';

export const bounceMonitorFn = inngest.createFunction(
  {
    id: 'bounce-monitor',
    name: 'Bounce Rate Monitor',
    retries: 1,
    triggers: [
      { cron: '0 6 * * *' }, // daily at 06:00 UTC
    ],
  },
  async ({ step }) => {
    // Load all campaigns
    const allCampaigns = await step.run('load-campaigns', async () => {
      const snap = await adminDb.collection('campaigns').get();
      return snap.docs.map((d) => ({ id: d.id, userId: d.data().userId as string }));
    });

    const alertsWritten: { campaignId: string; bounceRate: number }[] = [];

    for (const campaign of allCampaigns) {
      const stats = await step.run(`check-bounce-${campaign.id}`, async () => {
        const snap = await adminDb
          .collection('emails')
          .where('campaignId', '==', campaign.id)
          .get();

        let sent = 0;
        let bounced = 0;
        snap.docs.forEach((d) => {
          const status = d.data().status as string;
          if (status === 'sent' || status === 'opened' || status === 'replied') sent++;
          if (status === 'bounced') bounced++;
        });

        return { sent, bounced };
      });

      if (stats.sent === 0) continue;

      const bounceRate = stats.bounced / stats.sent;

      if (bounceRate > 0.05) {
        await step.run(`write-alert-${campaign.id}`, async () => {
          const alertRef = adminDb.collection('alerts').doc();
          await alertRef.set({
            id: alertRef.id,
            userId: campaign.userId,
            campaignId: campaign.id,
            type: 'high_bounce',
            value: bounceRate,
            read: false,
            createdAt: new Date().toISOString(),
          });
        });
        alertsWritten.push({ campaignId: campaign.id, bounceRate });
      }
    }

    return { campaignsChecked: allCampaigns.length, alertsWritten };
  },
);
