/**
 * Reply thread grouping.
 *
 * Threads group emails by leadId + campaignId.
 * Each thread is sorted by lastActivity desc.
 */

import type { Email } from "@/lib/schemas/campaign";

export interface Thread {
  id: string; // "${leadId}_${campaignId}"
  leadId: string;
  campaignId: string;
  emails: Email[];
  lastActivity: string; // ISO datetime of most recent email activity
}

/**
 * Group an array of emails into conversation threads.
 * A thread is keyed by leadId + campaignId.
 * Threads are returned sorted by lastActivity descending (newest first).
 */
export function groupByThread(emails: Email[]): Thread[] {
  const map = new Map<string, Thread>();

  for (const email of emails) {
    const leadId = email.leadId ?? "__unknown__";
    const campaignId = email.campaignId ?? "__unknown__";
    const threadId = `${leadId}_${campaignId}`;

    const existing = map.get(threadId);
    if (existing) {
      existing.emails.push(email);
      // Track the most recent activity timestamp
      const emailTime = email.repliedAt ?? email.sentAt ?? email.updatedAt ?? email.createdAt;
      if (emailTime > existing.lastActivity) {
        existing.lastActivity = emailTime;
      }
    } else {
      const emailTime = email.repliedAt ?? email.sentAt ?? email.updatedAt ?? email.createdAt;
      map.set(threadId, {
        id: threadId,
        leadId,
        campaignId,
        emails: [email],
        lastActivity: emailTime,
      });
    }
  }

  // Sort threads by lastActivity descending
  return Array.from(map.values()).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/**
 * Compute the threadId for an email. Exported so consumers can attach it.
 */
export function computeThreadId(
  leadId: string | undefined,
  campaignId: string | undefined
): string {
  return `${leadId ?? "__unknown__"}_${campaignId ?? "__unknown__"}`;
}
