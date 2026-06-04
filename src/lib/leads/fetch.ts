/**
 * Shared lead-fetching helper.
 *
 * Both `/api/leads` (the data source for the /customers page) and
 * `/api/emails/auto-draft` (which queues the user's outreach drafts) must use
 * the same ordering and the same `status === 'new'` filter so the first 20
 * customers visible in the UI are the exact same 20 leads we draft emails to.
 *
 * Returns documents ordered by `createdAt desc`, matching the customers list
 * default. Soft-deleted (`deletedAt != null`) leads are filtered out.
 */

import { adminDb } from '@/lib/firebase/admin';

export interface FetchedLead {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  status: 'new' | 'contacted' | 'replied' | 'booked' | 'unsubscribed' | 'bounced' | 'flagged';
  source: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface FetchLeadsOptions {
  /** Max number of leads to return. Auto-draft uses 20 to mirror the customers list. */
  limit: number;
  /** Restrict to a single status (e.g. 'new' for draft generation). Omit to return all statuses. */
  status?: FetchedLead['status'];
  /** Optional industry filter — mirrors `/api/leads?industry=`. */
  industry?: string;
}

export async function fetchUserLeads(
  userId: string,
  opts: FetchLeadsOptions,
): Promise<FetchedLead[]> {
  let q = adminDb
    .collection('leads')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(opts.limit);
  if (opts.status) q = q.where('status', '==', opts.status);
  if (opts.industry) q = q.where('industry', '==', opts.industry);

  const snap = await q.get();
  return snap.docs
    .map((d) => d.data() as FetchedLead)
    .filter((l) => !l.deletedAt);
}
