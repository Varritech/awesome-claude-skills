/**
 * Pure logic for the send-scheduled-emails cron route.
 *
 * Given a list of queued email docs whose scheduledFor is past, decide which
 * `email/send` events to emit. Resolves missing inboxId via a caller-supplied
 * lookup, caching the result per user.
 */

export interface QueuedEmail {
  id: string;
  userId: string;
  inboxId?: string | null;
  scheduledFor?: string | null;
  status: string;
}

export interface SendEvent {
  name: 'email/send';
  data: { emailId: string; inboxId: string; userId: string };
}

export interface BuildResult {
  events: SendEvent[];
  skippedNoInbox: number;
}

/**
 * Build send events from queued emails.
 *
 * @param queued    Queued email docs whose scheduledFor <= now.
 * @param resolveInbox  Async callback returning the active inboxId for a user,
 *                      or null if none. Called at most once per distinct userId.
 */
export async function buildSendEvents(
  queued: QueuedEmail[],
  resolveInbox: (userId: string) => Promise<string | null>,
): Promise<BuildResult> {
  const events: SendEvent[] = [];
  const userInboxCache = new Map<string, string | null>();
  let skippedNoInbox = 0;

  for (const email of queued) {
    let inboxId = email.inboxId ?? null;

    if (!inboxId) {
      if (!userInboxCache.has(email.userId)) {
        userInboxCache.set(email.userId, await resolveInbox(email.userId));
      }
      inboxId = userInboxCache.get(email.userId) ?? null;
    }

    if (!inboxId) {
      skippedNoInbox++;
      continue;
    }

    events.push({
      name: 'email/send',
      data: { emailId: email.id, inboxId, userId: email.userId },
    });
  }

  return { events, skippedNoInbox };
}
