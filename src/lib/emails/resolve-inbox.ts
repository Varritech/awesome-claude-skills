/**
 * For each queued email missing inboxId, look up the user's active inbox
 * (one cache hit per distinct userId) and persist it back to Firestore so
 * the dispatcher and subsequent ticks don't have to repeat the lookup.
 *
 * Mutates the input list in place: sets `email.inboxId` on records where
 * an active inbox was found.
 */

import type { Firestore } from 'firebase-admin/firestore';

export interface QueuedEmail {
  id: string;
  userId: string;
  inboxId?: string | null;
  scheduledFor?: string | null;
  status: string;
}

export interface ResolveResult {
  resolved: number;
  skippedNoInbox: number;
}

export async function resolveInboxForEmails(
  db: Firestore,
  emails: QueuedEmail[],
): Promise<ResolveResult> {
  let resolved = 0;
  let skippedNoInbox = 0;
  const cache = new Map<string, string | null>();

  for (const email of emails) {
    if (email.inboxId) continue;

    if (!cache.has(email.userId)) {
      const snap = await db
        .collection('inboxes')
        .where('userId', '==', email.userId)
        .where('status', 'in', ['warming', 'active'])
        .limit(1)
        .get();
      cache.set(email.userId, snap.empty ? null : snap.docs[0]!.id);
    }

    const inboxId = cache.get(email.userId) ?? null;
    if (!inboxId) {
      skippedNoInbox++;
      continue;
    }

    email.inboxId = inboxId;
    resolved++;
    // Best-effort persist; failure here doesn't break the dispatch.
    await db
      .collection('emails')
      .doc(email.id)
      .set({ inboxId, updatedAt: new Date().toISOString() }, { merge: true })
      .catch((err) => {
        console.warn(`[resolveInboxForEmails] failed to persist inboxId on ${email.id}`, err);
      });
  }

  return { resolved, skippedNoInbox };
}
