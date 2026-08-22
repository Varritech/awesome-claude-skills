// Email for the daily gated preview + reports.
// Default = Composio GMAIL_SEND_EMAIL (reuses the Composio key, no SMTP secrets,
// sends as christian@varritech.com — same house pattern as budget-claw/adwatch).
// Falls back to SMTP/nodemailer if EMAIL_TRANSPORT=smtp.
import nodemailer from "nodemailer";
import { config } from "../config.js";

const GMAIL_EXEC = "https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL";

async function sendViaComposio({ subject, html }) {
  const res = await fetch(GMAIL_EXEC, {
    method: "POST",
    headers: { "x-api-key": config.composio.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: config.composio.userId,
      arguments: { recipient_email: config.email.to, subject, body: html, is_html: true },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Composio GMAIL_SEND_EMAIL -> ${res.status} ${text}`);
  return true;
}

let tx;
async function sendViaSmtp({ subject, html, attachments }) {
  const e = config.email;
  tx ||= nodemailer.createTransport({
    host: e.smtpHost,
    port: e.smtpPort,
    secure: e.smtpSecure,
    auth: e.smtpUser ? { user: e.smtpUser, pass: e.smtpPass } : undefined,
  });
  await tx.sendMail({ from: e.from, to: e.to, subject, html, attachments });
  return true;
}

export async function sendMail({ subject, html, attachments }) {
  if (config.email.transport === "smtp" && config.email.smtpHost) {
    return sendViaSmtp({ subject, html, attachments });
  }
  if (config.composio.apiKey) return sendViaComposio({ subject, html });
  console.warn("[email] no transport configured; skipping. Subject:", subject);
  return false;
}
