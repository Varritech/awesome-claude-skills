/**
 * Inngest function: email/send
 *
 * Sends a single queued email via the inbox SMTP credentials.
 * Respects warmup quotas, handles bounces, updates Firestore.
 *
 * Retries: 3x with exponential backoff (Inngest default).
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail, type SmtpConfig } from "@/lib/smtp/mailer";
import { todayQuota } from "@/lib/warmup/scheduler";

export const sendEmailFn = inngest.createFunction(
  {
    id: "send-email",
    name: "Send Email",
    retries: 3,
    triggers: [{ event: "email/send" }],
    throttle: {
      limit: 1,
      period: "1s",
      key: "event.data.inboxId",
    },
  },
  async ({ event, step }) => {
    const { emailId, inboxId, testRecipient } = event.data;

    // ── 1. Load email record ──────────────────────────────────────────────────
    const emailDoc = await step.run("load-email", async () => {
      const snap = await adminDb.collection("emails").doc(emailId).get();
      if (!snap.exists) throw new Error(`Email ${emailId} not found`);
      return snap.data() as EmailRecord;
    });

    if (emailDoc.status !== "queued") {
      return { skipped: true, reason: `Email status is ${emailDoc.status}` };
    }

    // ── 2. Load inbox + check warmup quota ───────────────────────────────────
    const inbox = await step.run("load-inbox", async () => {
      const snap = await adminDb.collection("inboxes").doc(inboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${inboxId} not found`);
      return snap.data() as InboxRecord;
    });

    const quota = todayQuota({
      warmupEnabled: inbox.warmupEnabled,
      warmupStartDate: inbox.warmupStartDate ?? null,
      dailySendLimit: inbox.dailySendLimit,
      status: inbox.status,
    });

    // Count how many emails already sent today from this inbox
    const sentToday = await step.run("count-sent-today", async () => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const snap = await adminDb
        .collection("emails")
        .where("inboxId", "==", inboxId)
        .where("status", "==", "sent")
        .where("sentAt", ">=", startOfDay.toISOString())
        .get();
      return snap.size;
    });

    if (sentToday >= quota) {
      await step.run("requeue-tomorrow", async () => {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(8, 0, 0, 0);
        await adminDb
          .collection("emails")
          .doc(emailId)
          .set(
            {
              status: "queued",
              scheduledAt: tomorrow.toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      });
      return { skipped: true, reason: "Daily quota reached, requeued for tomorrow" };
    }

    // ── 3. Build SMTP config ──────────────────────────────────────────────────
    if (!inbox.smtpHost || !inbox.smtpPort || !inbox.smtpUser || !inbox.smtpPasswordEncrypted) {
      await step.run("mark-error", async () => {
        await adminDb
          .collection("emails")
          .doc(emailId)
          .set(
            {
              status: "bounced",
              error: "Inbox SMTP not configured",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      });
      throw new Error(`Inbox ${inboxId} has no SMTP credentials`);
    }

    const smtpConfig: SmtpConfig = {
      host: inbox.smtpHost,
      port: inbox.smtpPort,
      user: inbox.smtpUser,
      encryptedPassword: inbox.smtpPasswordEncrypted,
    };

    // ── 4. Load lead for personalization ─────────────────────────────────────
    const lead = emailDoc.leadId
      ? await step.run("load-lead", async () => {
          const snap = await adminDb.collection("leads").doc(emailDoc.leadId!).get();
          return snap.exists ? (snap.data() as LeadRecord) : null;
        })
      : null;

    // ── 5. Personalize body ───────────────────────────────────────────────────
    const personalizedBody = personalize(emailDoc.body, lead);
    const personalizedSubject = personalize(emailDoc.subject, lead);
    const recipient = testRecipient ?? lead?.email ?? emailDoc.toEmail;

    if (!recipient) {
      await step.run("mark-no-recipient", async () => {
        await adminDb
          .collection("emails")
          .doc(emailId)
          .set(
            { status: "bounced", error: "No recipient email", updatedAt: new Date().toISOString() },
            { merge: true }
          );
      });
      return { skipped: true, reason: "No recipient email address" };
    }

    // ── 6. Send ───────────────────────────────────────────────────────────────
    const result = await step.run("send-smtp", async () => {
      return sendEmail(smtpConfig, {
        from: inbox.displayName ? `${inbox.displayName} <${inbox.email}>` : inbox.email,
        to: recipient,
        subject: personalizedSubject,
        html: bodyToHtml(personalizedBody),
        text: personalizedBody,
        headers: {
          "X-Campaign-Id": emailDoc.campaignId ?? "",
          "X-Email-Id": emailId,
        },
      });
    });

    // ── 7. Update Firestore ───────────────────────────────────────────────────
    await step.run("mark-sent", async () => {
      const now = new Date().toISOString();
      const batch = adminDb.batch();

      batch.set(
        adminDb.collection("emails").doc(emailId),
        {
          status: result.rejected.length > 0 ? "bounced" : "sent",
          sentAt: now,
          messageId: result.messageId,
          recipient,
          updatedAt: now,
        },
        { merge: true }
      );

      if (lead && emailDoc.leadId && !testRecipient) {
        batch.set(
          adminDb.collection("leads").doc(emailDoc.leadId),
          { status: "contacted", updatedAt: now },
          { merge: true }
        );
      }

      await batch.commit();
    });

    return {
      emailId,
      messageId: result.messageId,
      recipient,
      testMode: !!testRecipient,
    };
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function personalize(template: string, lead: LeadRecord | null): string {
  if (!lead) return template;
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName ?? "")
    .replace(/\{\{lastName\}\}/g, lead.lastName ?? "")
    .replace(/\{\{fullName\}\}/g, [lead.firstName, lead.lastName].filter(Boolean).join(" "))
    .replace(/\{\{company\}\}/g, lead.company ?? "")
    .replace(/\{\{title\}\}/g, lead.title ?? "")
    .replace(/\{\{industry\}\}/g, lead.industry ?? "")
    .replace(/\{\{location\}\}/g, lead.location ?? "");
}

export function bodyToHtml(text: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${text
    .split("\n")
    .map((l) => `<p style="margin:0 0 8px">${l}</p>`)
    .join("")}</div>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailRecord {
  id: string;
  userId: string;
  campaignId?: string;
  leadId?: string;
  toEmail?: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string | null;
  messageId?: string;
  inboxId?: string;
}

interface InboxRecord {
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

interface LeadRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
}
