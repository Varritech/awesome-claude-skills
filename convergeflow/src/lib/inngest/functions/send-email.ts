/**
 * Inngest function: email/send
 *
 * Sends a single queued email via the inbox SMTP credentials.
 * Respects warmup quotas, handles bounces, updates Firestore.
 *
 * New in sending-engine:
 * - Multi-inbox rotation: picks inbox by campaignEmailIndex % inboxIds.length
 * - A/B variant assignment: applies subjectSuffix/bodySuffix per variant
 * - Fires email/bounced event so bounce-monitor can auto-pause campaigns
 *
 * Retries: 3x with exponential backoff (Inngest default).
 */

import { inngest } from "../client";
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail, type SmtpConfig } from "@/lib/smtp/mailer";
import { todayQuota } from "@/lib/warmup/scheduler";
import { pickRotationInbox, assignAbVariant } from "./sending-logic";
import type { AbVariant } from "./sending-logic";

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
    const { emailId, testRecipient } = event.data;

    // ── 1. Load email record ──────────────────────────────────────────────────
    const emailDoc = await step.run("load-email", async () => {
      const snap = await adminDb.collection("emails").doc(emailId).get();
      if (!snap.exists) throw new Error(`Email ${emailId} not found`);
      return snap.data() as EmailRecord;
    });

    if (emailDoc.status !== "queued") {
      return { skipped: true, reason: `Email status is ${emailDoc.status}` };
    }

    // ── 2. Load campaign (for rotation + A/B) ─────────────────────────────────
    const campaign = emailDoc.campaignId
      ? await step.run("load-campaign", async () => {
          const snap = await adminDb.collection("campaigns").doc(emailDoc.campaignId!).get();
          return snap.exists ? (snap.data() as CampaignRecord) : null;
        })
      : null;

    // ── 3. Determine inbox (rotation or fallback to event.data.inboxId) ───────
    const resolvedInboxId = await step.run("resolve-inbox", async () => {
      if (campaign?.inboxIds && campaign.inboxIds.length > 0) {
        // Atomically increment emailIndex and pick rotation inbox
        const campaignRef = adminDb.collection("campaigns").doc(campaign.id);
        let emailIndex = 0;
        try {
          await adminDb.runTransaction(async (tx) => {
            const doc = await tx.get(campaignRef);
            const current = (doc.data() as CampaignRecord)?.emailIndex ?? 0;
            emailIndex = current;
            tx.update(campaignRef, {
              emailIndex: current + 1,
              updatedAt: new Date().toISOString(),
            });
          });
        } catch (err) {
          console.warn("[send-email] emailIndex transaction failed, using 0", err);
        }
        return pickRotationInbox(campaign.inboxIds, emailIndex);
      }
      return event.data.inboxId ?? emailDoc.inboxId ?? "";
    });

    if (!resolvedInboxId) {
      await step.run("mark-no-inbox", async () => {
        await adminDb
          .collection("emails")
          .doc(emailId)
          .set(
            { status: "bounced", error: "No inbox resolved", updatedAt: new Date().toISOString() },
            { merge: true }
          );
      });
      return { skipped: true, reason: "No inbox resolved" };
    }

    // ── 4. Load inbox + check warmup quota ────────────────────────────────────
    const inbox = await step.run("load-inbox", async () => {
      const snap = await adminDb.collection("inboxes").doc(resolvedInboxId).get();
      if (!snap.exists) throw new Error(`Inbox ${resolvedInboxId} not found`);
      return snap.data() as InboxRecord;
    });

    const quota = todayQuota({
      warmupEnabled: inbox.warmupEnabled,
      warmupStartDate: inbox.warmupStartDate ?? null,
      dailySendLimit: inbox.dailySendLimit,
      status: inbox.status,
    });

    const sentToday = await step.run("count-sent-today", async () => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const snap = await adminDb
        .collection("emails")
        .where("inboxId", "==", resolvedInboxId)
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
        await adminDb.collection("emails").doc(emailId).set(
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

    // ── 5. Build SMTP config ───────────────────────────────────────────────────
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
      await step.sendEvent("bounce-event", {
        name: "email/bounced" as const,
        data: {
          emailId,
          campaignId: emailDoc.campaignId ?? "",
          userId: emailDoc.userId,
          reason: "smtp_not_configured",
        },
      });
      throw new Error(`Inbox ${resolvedInboxId} has no SMTP credentials`);
    }

    const smtpConfig: SmtpConfig = {
      host: inbox.smtpHost,
      port: inbox.smtpPort,
      user: inbox.smtpUser,
      encryptedPassword: inbox.smtpPasswordEncrypted,
    };

    // ── 6. Load lead for personalization ──────────────────────────────────────
    const lead = emailDoc.leadId
      ? await step.run("load-lead", async () => {
          const snap = await adminDb.collection("leads").doc(emailDoc.leadId!).get();
          return snap.exists ? (snap.data() as LeadRecord) : null;
        })
      : null;

    // ── 7. A/B variant assignment ─────────────────────────────────────────────
    const abVariantLabel = await step.run("assign-ab-variant", async () => {
      if (!campaign?.abVariants || campaign.abVariants.length === 0) return null;
      // Use email ID hash as deterministic random so re-runs produce the same variant
      const hash = emailId.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const r = (hash % 1000) / 1000;
      return assignAbVariant(campaign.abVariants as AbVariant[], r);
    });

    // ── 8. Personalize body with A/B suffixes ─────────────────────────────────
    let subject = personalize(emailDoc.subject, lead);
    let body = personalize(emailDoc.body, lead);

    if (abVariantLabel && campaign?.abVariants) {
      const variant = campaign.abVariants.find((v) => v.label === abVariantLabel);
      if (variant) {
        subject += variant.subjectSuffix ?? "";
        body += variant.bodySuffix ?? "";
      }
    }

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
      await step.sendEvent("bounce-no-recipient", {
        name: "email/bounced" as const,
        data: {
          emailId,
          campaignId: emailDoc.campaignId ?? "",
          userId: emailDoc.userId,
          reason: "no_recipient",
        },
      });
      return { skipped: true, reason: "No recipient email address" };
    }

    // ── 9. Send ────────────────────────────────────────────────────────────────
    const result = await step.run("send-smtp", async () => {
      return sendEmail(smtpConfig, {
        from: inbox.displayName ? `${inbox.displayName} <${inbox.email}>` : inbox.email,
        to: recipient,
        subject,
        html: bodyToHtml(body),
        text: body,
        headers: {
          "X-Campaign-Id": emailDoc.campaignId ?? "",
          "X-Email-Id": emailId,
        },
      });
    });

    const wasBounced = result.rejected.length > 0;

    // ── 10. Update Firestore ───────────────────────────────────────────────────
    await step.run("mark-sent", async () => {
      const now = new Date().toISOString();
      const batch = adminDb.batch();

      batch.set(
        adminDb.collection("emails").doc(emailId),
        {
          status: wasBounced ? "bounced" : "sent",
          sentAt: now,
          messageId: result.messageId,
          recipient,
          inboxId: resolvedInboxId,
          updatedAt: now,
          ...(abVariantLabel ? { abVariant: abVariantLabel } : {}),
        },
        { merge: true }
      );

      if (lead && emailDoc.leadId && !testRecipient) {
        batch.set(
          adminDb.collection("leads").doc(emailDoc.leadId),
          { status: wasBounced ? "bounced" : "contacted", updatedAt: now },
          { merge: true }
        );
      }

      await batch.commit();
    });

    // ── 11. Fire bounce event if rejected ─────────────────────────────────────
    if (wasBounced) {
      await step.sendEvent("fire-bounce-event", {
        name: "email/bounced" as const,
        data: {
          emailId,
          campaignId: emailDoc.campaignId ?? "",
          userId: emailDoc.userId,
          reason: "smtp_rejected",
        },
      });
    }

    return {
      emailId,
      messageId: result.messageId,
      recipient,
      inboxId: resolvedInboxId,
      abVariant: abVariantLabel,
      testMode: !!testRecipient,
      bounced: wasBounced,
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

interface CampaignRecord {
  id: string;
  userId: string;
  inboxIds?: string[];
  emailIndex?: number;
  abVariants?: Array<{ label: string; subjectSuffix: string; bodySuffix: string; weight: number }>;
  replyAction?: string;
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
