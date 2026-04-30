/**
 * Inngest cron: daily-lead-refresh
 *
 * Runs at 8:00 AM UTC every day.
 * For every user that has leads stored in Firestore, deletes their existing
 * lead batch and fetches a fresh one from ALeads based on their saved industry.
 * This ensures the pool never goes stale.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import * as aleads from '@/lib/aleads/client';

interface UserProfile {
  industry?: string;
}

export const dailyLeadRefreshFn = inngest.createFunction(
  {
    id: 'daily-lead-refresh',
    name: 'Daily Lead Refresh',
    retries: 2,
    triggers: [{ cron: '0 8 * * *' }],
  },
  async ({ step }) => {
    // ── 1. Find all distinct userIds that have leads ──────────────────────────
    const userIds = await step.run('collect-user-ids', async () => {
      const snap = await adminDb.collection('leads').select('userId').get();
      const ids = new Set<string>();
      snap.docs.forEach((d) => {
        const uid = d.data().userId as string | undefined;
        if (uid) ids.add(uid);
      });
      return Array.from(ids);
    });

    if (userIds.length === 0) return { refreshed: 0 };

    // ── 2. Refresh each user's leads ──────────────────────────────────────────
    let refreshed = 0;

    for (const userId of userIds) {
      await step.run(`refresh-leads-${userId}`, async () => {
        // Load their industry from profile
        const profileDoc = await adminDb.collection('users').doc(userId).get();
        const profile = profileDoc.data() as UserProfile | undefined;
        const industry = profile?.industry;

        // Delete all existing leads for this user
        const existing = await adminDb
          .collection('leads')
          .where('userId', '==', userId)
          .get();

        const deleteBatch = adminDb.batch();
        existing.docs.forEach((d) => deleteBatch.delete(d.ref));
        await deleteBatch.commit();

        // Fetch fresh batch from ALeads
        if (!aleads.isConfigured()) return;

        const res = await aleads.searchContacts({ industry, limit: 20 });
        if (!res.data.length) return;

        const now = new Date().toISOString();
        const strip = (obj: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

        const insertBatch = adminDb.batch();
        for (const c of res.data) {
          const id = `ld_al_${c.id}`;
          insertBatch.set(
            adminDb.collection('leads').doc(id),
            strip({
              id,
              userId,
              firstName: c.first_name,
              lastName: c.last_name,
              email: c.email,
              company: c.company,
              title: c.title,
              industry: c.industry ?? industry,
              location: c.location,
              status: 'new',
              source: 'aleads',
              score: c.confidence ? Math.round(c.confidence * 100) : 0,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            }),
          );
        }
        await insertBatch.commit();
      });

      refreshed++;
    }

    return { refreshed };
  },
);
