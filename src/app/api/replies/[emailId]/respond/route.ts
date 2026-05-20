/**
 * POST /api/replies/[emailId]/respond
 *
 * Sends a manual reply to an email thread via SMTP.
 * Optionally requests an AI draft via GET /api/replies/[emailId]/respond?draft=true.
 *
 * POST body: { body: string, subject?: string }
 * Creates a new email record with isManualReply: true.
 * Updates the original email's repliedAt timestamp.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail } from "@/lib/smtp/mailer";
import { bodyToHtml } from "@/lib/inngest/functions/send-email";
import { ollamaClient } from "@/lib/ollama/client";
import { requireUser, jsonError, parseAndValidate, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: { emailId: string };
}

const respondSchema = z.object({
  body: z.string().min(1).max(20_000),
  subject: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { emailId } = ctx.params;

  const parsed = await parseAndValidate(req, respondSchema);
  if (parsed.response) return parsed.response;
  const { body, subject } = parsed.data;

  logRequest("replies.[emailId].respond.POST", userId, { emailId });

  try {
    // Load original email
    const emailSnap = await adminDb.collection("emails").doc(emailId).get();
    if (!emailSnap.exists) return jsonError("Email not found", 404);
    const originalEmail = { id: emailSnap.id, ...emailSnap.data() } as Record<string, unknown>;

    if (originalEmail.userId !== userId) return jsonError("Forbidden", 403);

    // Load inbox for SMTP config
    const inboxId = originalEmail.inboxId as string | undefined;
    if (!inboxId) return jsonError("No inbox associated with this email", 400);

    const inboxSnap = await adminDb.collection("inboxes").doc(inboxId).get();
    if (!inboxSnap.exists) return jsonError("Inbox not found", 404);
    const inbox = inboxSnap.data() as Record<string, unknown>;

    if (!inbox.smtpHost || !inbox.smtpPort || !inbox.smtpUser || !inbox.smtpPasswordEncrypted) {
      return jsonError("Inbox SMTP not configured", 400);
    }

    // Load lead for recipient email
    const leadId = originalEmail.leadId as string | undefined;
    let recipientEmail: string | undefined;
    let leadRecord: Record<string, unknown> | null = null;

    if (leadId) {
      const leadSnap = await adminDb.collection("leads").doc(leadId).get();
      if (leadSnap.exists) {
        leadRecord = { id: leadSnap.id, ...leadSnap.data() } as Record<string, unknown>;
        recipientEmail = leadRecord.email as string | undefined;
      }
    }

    if (!recipientEmail) return jsonError("No recipient email found", 400);

    const replySubject = subject ?? `Re: ${originalEmail.subject ?? ""}`;

    // Send via SMTP
    await sendEmail(
      {
        host: inbox.smtpHost as string,
        port: inbox.smtpPort as number,
        user: inbox.smtpUser as string,
        encryptedPassword: inbox.smtpPasswordEncrypted as string,
      },
      {
        from: (inbox.displayName as string)
          ? `${inbox.displayName} <${inbox.email}>`
          : (inbox.email as string),
        to: recipientEmail,
        subject: replySubject,
        html: bodyToHtml(body),
        text: body,
        headers: {
          "X-Campaign-Id": (originalEmail.campaignId as string) ?? "",
          "X-Email-Id": emailId,
          "In-Reply-To": (originalEmail.messageId as string) ?? "",
        },
      }
    );

    const now = new Date().toISOString();

    // Create new email record for the reply
    const newEmailRef = adminDb.collection("emails").doc();
    await newEmailRef.set({
      userId,
      campaignId: originalEmail.campaignId ?? null,
      leadId: originalEmail.leadId ?? null,
      inboxId,
      subject: replySubject,
      body,
      status: "sent",
      persona: originalEmail.persona ?? "closer",
      isManualReply: true,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Update original email's repliedAt
    await adminDb
      .collection("emails")
      .doc(emailId)
      .set({ repliedAt: now, updatedAt: now }, { merge: true });

    return NextResponse.json({ data: { id: newEmailRef.id, sentAt: now } });
  } catch (err) {
    console.error("[api:replies.[emailId].respond.POST]", err);
    return jsonError("Failed to send reply", 500);
  }
}

/**
 * GET /api/replies/[emailId]/respond?draft=true
 *
 * Generates an AI draft reply based on the original email + lead context.
 */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { emailId } = ctx.params;

  logRequest("replies.[emailId].respond.GET", userId, { emailId });

  try {
    const emailSnap = await adminDb.collection("emails").doc(emailId).get();
    if (!emailSnap.exists) return jsonError("Email not found", 404);
    const email = { id: emailSnap.id, ...emailSnap.data() } as Record<string, unknown>;

    if (email.userId !== userId) return jsonError("Forbidden", 403);

    // Load lead for context
    let leadContext = "";
    if (email.leadId) {
      const leadSnap = await adminDb
        .collection("leads")
        .doc(email.leadId as string)
        .get();
      if (leadSnap.exists) {
        const lead = leadSnap.data() as Record<string, unknown>;
        leadContext = `Lead: ${lead.firstName ?? ""} ${lead.lastName ?? ""} at ${lead.company ?? "unknown company"} (${lead.title ?? ""})`;
      }
    }

    const prompt = [
      "Draft a concise, professional reply to this cold email exchange.",
      leadContext ? `Context: ${leadContext}` : "",
      `Original email subject: ${email.subject ?? ""}`,
      `Original email body: ${email.body ?? ""}`,
      `Incoming reply body: ${email.replyBody ?? ""}`,
      "Keep the reply short (2-4 sentences), human, and action-oriented.",
    ]
      .filter(Boolean)
      .join("\n");

    const draft = await ollamaClient.chat([
      {
        role: "system",
        content: "You are a professional cold email assistant. Write concise, human replies.",
      },
      { role: "user", content: prompt },
    ]);

    return NextResponse.json({ data: { draft } });
  } catch (err) {
    console.error("[api:replies.[emailId].respond.GET]", err);
    return jsonError("Failed to generate draft", 502);
  }
}
