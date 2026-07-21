/**
 * Inngest function: inbox/poll-replies
 *
 * Polls a single inbox via IMAP for new replies, classifies each reply,
 * and updates Firestore (email + lead records).
 *
 * Triggered by the Vercel Cron endpoint every 2 minutes for each active inbox.
 * Each inbox gets its own event so failures are isolated.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { fetchNewReplies, type ImapConfig } from '@/lib/imap/client';
import { classifyReplyPipeline } from '@/lib/classify/pipeline';
import * as Sentry from '@sentry/nextjs';

export const pollRepliesFn = inngest.createFunction(
  {
    id: 'poll-replies',
    name: 'Poll Inbox Replies',
    retries: 2,
    triggers: [{ event: 'inbox/poll-replies' }],
    throttle: {
      limit: 1,
      period: '30s',
      key: 'event.data.inboxId',
    },
  },
  async ({ event, step }) => {
    const { inboxId, userId } = event.data;

    // ── 1. Load inbox ───────────────────────────────────────────────────────
    const inbox = await step.run('load-inbox', async () => {
      const snap = await adminDb.collection('inboxes').doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return { id: inboxId, ...snap.data() } as InboxRecord;
    });

    // Skip if IMAP is not configured
    if (!inbox.imapHost || !inbox.imapUser || !inbox.imapPasswordEncrypted) {
      return { skipped: true, reason: 'IMAP not configured' };
    }

    // ── 2. Determine poll window ────────────────────────────────────────────
    const lastPolledAt = inbox.lastPolledAt
      ? new Date(inbox.lastPolledAt)
      : new Date(Date.now() - 5 * 60 * 1000); // default: 5 min ago

    const imapConfig: ImapConfig = {
      host: inbox.imapHost,
      port: inbox.imapPort ?? 993,
      user: inbox.imapUser,
      encryptedPassword: inbox.imapPasswordEncrypted,
    };

    // ── 3. Fetch new replies ────────────────────────────────────────────────
    const replies = await step.run('fetch-replies', async () => {
      try {
        return await fetchNewReplies(imapConfig, lastPolledAt);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'poll-replies', inboxId },
        });
        return [];
      }
    });

    if (replies.length === 0) {
      // Update lastPolledAt even when no replies found
      await step.run('update-poll-timestamp', async () => {
        await adminDb
          .collection('inboxes')
          .doc(inboxId)
          .set({ lastPolledAt: new Date().toISOString() }, { merge: true });
      });
      return { inboxId, repliesFound: 0 };
    }

    // ── 4. Process each reply ───────────────────────────────────────────────
    const results: ClassificationSummary[] = [];

    for (let i = 0; i < replies.length; i++) {
      const rawReply = replies[i]!;
      // Inngest serializes step results to JSON, so Date objects become strings.
      // Reconstruct the Date for the FetchedReply type.
      const reply = {
        ...rawReply,
        receivedAt: new Date(rawReply.receivedAt as unknown as string),
        headers: {
          ...rawReply.headers,
          date: rawReply.headers.date ? new Date(rawReply.headers.date as unknown as string) : undefined,
        },
      };
      const result = await step.run(`process-reply-${i}`, async () => {
        return processReply(reply, userId);
      });
      results.push(result);
    }

    // ── 5. Update poll timestamp ────────────────────────────────────────────
    await step.run('update-poll-timestamp', async () => {
      await adminDb
        .collection('inboxes')
        .doc(inboxId)
        .set({ lastPolledAt: new Date().toISOString() }, { merge: true });
    });

    const categoryCounts: Record<string, number> = {};
    for (const r of results) {
      categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
    }

    return {
      inboxId,
      repliesFound: results.length,
      categories: categoryCounts,
    };
  },
);

// ─── Reply processing ────────────────────────────────────────────────────────

interface ClassificationSummary {
  category: string;
  matched: boolean;
  emailId?: string;
  leadId?: string;
}

async function processReply(
  reply: Awaited<ReturnType<typeof fetchNewReplies>>[number],
  userId: string,
): Promise<ClassificationSummary> {
  const now = new Date().toISOString();

  // ── Find the original email ────────────────────────────────────────────────
  const originalEmail = await findOriginalEmail(
    reply.headers.inReplyTo,
    reply.headers.references,
    reply.headers.messageId,
    userId,
  );

  if (!originalEmail) {
    return { category: 'unmatched', matched: false };
  }

  // ── Classify the reply ────────────────────────────────────────────────────
  const classification = await classifyReplyPipeline(reply, {
    originalEmail: originalEmail.body,
    leadName: originalEmail.leadName,
  });

  // ── Update email record ───────────────────────────────────────────────────
  try {
    await adminDb
      .collection('emails')
      .doc(originalEmail.id)
      .set(
        {
          status: 'replied',
          repliedAt: now,
          replyCategory: classification.category,
          replyText: reply.bodyText.slice(0, 10_000),
          replyClassifiedAt: now,
          replyFromEmail: extractEmailAddress(reply.headers.from),
          updatedAt: now,
        },
        { merge: true },
      );

    // ── Update lead record ──────────────────────────────────────────────────
    if (originalEmail.leadId) {
      const leadUpdate: Record<string, unknown> = {
        status: 'replied',
        updatedAt: now,
      };
      if (classification.category === 'booked') {
        leadUpdate.status = 'booked';
      } else if (classification.category === 'not_interested') {
        leadUpdate.status = 'unsubscribed';
      }
      await adminDb
        .collection('leads')
        .doc(originalEmail.leadId)
        .set(leadUpdate, { merge: true });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'poll-replies', method: 'processReply' },
    });
  }

  return {
    category: classification.category,
    matched: true,
    emailId: originalEmail.id,
    leadId: originalEmail.leadId,
  };
}

// ─── Original email lookup ───────────────────────────────────────────────────

interface OriginalEmail {
  id: string;
  body: string;
  leadId?: string;
  leadName?: string;
}

async function findOriginalEmail(
  inReplyTo?: string,
  references?: string,
  _messageId?: string,
  _userId?: string,
): Promise<OriginalEmail | null> {
  // Try matching by In-Reply-To or References header to the sent messageId
  const candidateIds = [
    inReplyTo,
    ...(references ? references.split(/\s+/) : []),
  ]
    .map((id) => id?.trim().replace(/^<|>$/g, ''))
    .filter(Boolean);

  for (const candidateId of candidateIds) {
    const snap = await adminDb
      .collection('emails')
      .where('messageId', '==', candidateId)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0]!;
      const data = doc.data();
      return {
        id: doc.id,
        body: data.body ?? '',
        leadId: data.leadId,
        leadName: data.leadName,
      };
    }
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmailAddress(from?: string): string {
  if (!from) return '';
  const match = from.match(/<([^>]+)>/);
  return match ? match[1]! : from.trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InboxRecord {
  id: string;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPasswordEncrypted?: string;
  lastPolledAt?: string | null;
}
