/**
 * Email dispatch — pure send logic, no Inngest dependency.
 *
 * Used by the cron route `/api/cron/send-scheduled-emails` to actually send
 * a queued email via the inbox's SMTP credentials. Mirrors the work that
 * `sendEmailFn` (the Inngest function) was doing, minus the step.run wrappers
 * and event-key plumbing.
 *
 * Caller is responsible for per-inbox throttling (e.g. sleep between calls
 * with the same inboxId).
 */

import type { Firestore } from 'firebase-admin/firestore';
import { sendEmail, type SendResult, type SmtpConfig } from '@/lib/smtp/mailer';
import { todayQuota } from '@/lib/warmup/scheduler';

export interface EmailRecord {
  id: string;
  userId: string;
  campaignId?: string | null;
  leadId?: string | null;
  toEmail?: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string | null;
  messageId?: string;
  inboxId?: string;
}

export interface InboxRecord {
  id: string;
  email: string;
  displayName?: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
}

export interface LeadRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
}

export type DispatchOutcome =
  | { kind: 'sent'; emailId: string; messageId: string; recipient: string }
  | { kind: 'bounced'; emailId: string; reason: string }
  | { kind: 'skipped'; emailId: string; reason: string }
  | { kind: 'requeued'; emailId: string; scheduledFor: string };

/**
 * Dispatch a single queued email.
 *
 * Steps:
 *   1. Load email + inbox docs
 *   2. Check warmup quota — if already over today's cap, requeue for tomorrow 8am
 *   3. Personalize subject/body with lead fields
 *   4. Send via SMTP
 *   5. Update Firestore (status = sent | bounced, sentAt, messageId)
 *
 * Returns a DispatchOutcome describing what happened. Throws only on
 * unrecoverable infra errors (missing inbox doc, etc.) so the cron route
 * can catch + log per-email failures without aborting the whole batch.
 */
export async function dispatchEmail(
  db: Firestore,
  emailId: string,
  options: { sender?: typeof sendEmail } = {},
): Promise<DispatchOutcome> {
  const send = options.sender ?? sendEmail;

  // 1. Load email
  const emailSnap = await db.collection('emails').doc(emailId).get();
  if (!emailSnap.exists) {
    return { kind: 'skipped', emailId, reason: 'email not found' };
  }
  const emailDoc = emailSnap.data() as EmailRecord;

  if (emailDoc.status !== 'queued') {
    return { kind: 'skipped', emailId, reason: `status=${emailDoc.status}` };
  }
  if (!emailDoc.inboxId) {
    return { kind: 'skipped', emailId, reason: 'no inboxId on record' };
  }

  // 2. Load inbox
  const inboxSnap = await db.collection('inboxes').doc(emailDoc.inboxId).get();
  if (!inboxSnap.exists) {
    return { kind: 'skipped', emailId, reason: 'inbox not found' };
  }
  const inbox = inboxSnap.data() as InboxRecord;

  if (!inbox.smtpHost || !inbox.smtpPort || !inbox.smtpUser || !inbox.smtpPasswordEncrypted) {
    await db.collection('emails').doc(emailId).set(
      { status: 'bounced', error: 'Inbox SMTP not configured', updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { kind: 'bounced', emailId, reason: 'inbox SMTP not configured' };
  }

  // 3. Warmup quota check
  const quota = todayQuota({
    warmupEnabled: inbox.warmupEnabled,
    warmupStartDate: inbox.warmupStartDate ?? null,
    dailySendLimit: inbox.dailySendLimit,
    status: inbox.status,
  });

  const startOfDayIso = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const sentTodaySnap = await db
    .collection('emails')
    .where('inboxId', '==', emailDoc.inboxId)
    .where('status', '==', 'sent')
    .where('sentAt', '>=', startOfDayIso)
    .count()
    .get();
  const sentToday = sentTodaySnap.data().count;

  if (sentToday >= quota) {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(8, 0, 0, 0);
    const scheduledFor = tomorrow.toISOString();
    await db.collection('emails').doc(emailId).set(
      { status: 'queued', scheduledFor, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { kind: 'requeued', emailId, scheduledFor };
  }

  // 4. Resolve recipient + personalize
  const lead = emailDoc.leadId
    ? await db
        .collection('leads')
        .doc(emailDoc.leadId)
        .get()
        .then((s) => (s.exists ? (s.data() as LeadRecord) : null))
    : null;

  const recipient = lead?.email ?? emailDoc.toEmail;
  if (!recipient) {
    await db.collection('emails').doc(emailId).set(
      { status: 'bounced', error: 'No recipient', updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { kind: 'bounced', emailId, reason: 'no recipient' };
  }

  const subject = personalize(emailDoc.subject, lead);
  const body = personalize(emailDoc.body, lead);

  // 5. Send
  const smtpConfig: SmtpConfig = {
    host: inbox.smtpHost,
    port: inbox.smtpPort,
    user: inbox.smtpUser,
    encryptedPassword: inbox.smtpPasswordEncrypted,
  };

  let result: SendResult;
  try {
    result = await send(smtpConfig, {
      from: inbox.displayName ? `${inbox.displayName} <${inbox.email}>` : inbox.email,
      to: recipient,
      subject,
      html: bodyToHtml(body),
      text: body,
      headers: {
        'X-Campaign-Id': emailDoc.campaignId ?? '',
        'X-Email-Id': emailId,
      },
    });
  } catch (err) {
    // Leave status=queued so the next cron tick retries.
    const message = err instanceof Error ? err.message : String(err);
    await db.collection('emails').doc(emailId).set(
      { lastError: message, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { kind: 'skipped', emailId, reason: `SMTP send failed: ${message}` };
  }

  // 6. Persist outcome
  const now = new Date().toISOString();
  const wasBounced = result.rejected.length > 0;
  const batch = db.batch();

  batch.set(
    db.collection('emails').doc(emailId),
    {
      status: wasBounced ? 'bounced' : 'sent',
      sentAt: now,
      messageId: result.messageId,
      recipient,
      updatedAt: now,
    },
    { merge: true },
  );

  if (lead && emailDoc.leadId) {
    batch.set(
      db.collection('leads').doc(emailDoc.leadId),
      { status: 'contacted', updatedAt: now },
      { merge: true },
    );
  }

  await batch.commit();

  return wasBounced
    ? { kind: 'bounced', emailId, reason: `rejected by remote: ${result.rejected.join(',')}` }
    : { kind: 'sent', emailId, messageId: result.messageId, recipient };
}

export function personalize(template: string, lead: LeadRecord | null): string {
  if (!lead) return template;
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName ?? '')
    .replace(/\{\{lastName\}\}/g, lead.lastName ?? '')
    .replace(/\{\{fullName\}\}/g, [lead.firstName, lead.lastName].filter(Boolean).join(' '))
    .replace(/\{\{company\}\}/g, lead.company ?? '')
    .replace(/\{\{title\}\}/g, lead.title ?? '')
    .replace(/\{\{industry\}\}/g, lead.industry ?? '')
    .replace(/\{\{location\}\}/g, lead.location ?? '');
}

export function bodyToHtml(text: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${text
    .split('\n')
    .map((l) => `<p style="margin:0 0 8px">${l}</p>`)
    .join('')}</div>`;
}
