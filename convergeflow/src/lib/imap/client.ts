/**
 * IMAP client wrapper for ConvergeFlow.
 *
 * Uses imapflow (modern, Promise-based IMAP) to poll inboxes for new replies.
 * Credentials are stored encrypted in Firestore (AES-256-GCM) and decrypted
 * at runtime using the same SMTP_ENCRYPTION_KEY as the SMTP mailer.
 *
 * All methods handle connection errors gracefully — they log to console and
 * return empty/fallback values rather than throwing, so a single broken inbox
 * doesn't crash the poller.
 */

import { ImapFlow } from 'imapflow';
import { decryptPassword } from '@/lib/smtp/mailer';
import * as Sentry from '@sentry/nextjs';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  encryptedPassword: string; // AES-256-GCM encrypted, same format as SMTP
}

export interface EmailHeaders {
  subject?: string;
  from?: string;
  to?: string;
  date?: Date;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  [key: string]: string | string[] | Date | undefined;
}

export interface FetchedReply {
  /** IMAP UID — unique per mailbox, used for dedup */
  uid: number;
  /** Parsed email headers */
  headers: EmailHeaders;
  /** Plain-text body (decoded from quoted-printable / base64) */
  bodyText: string;
  /** HTML body if available */
  bodyHtml?: string;
  /** Raw RFC822 message source (for debugging) */
  raw?: string;
  /** When the message was received by the server */
  receivedAt: Date;
}

/**
 * Connect to an IMAP mailbox and fetch unseen messages since a given date.
 * Disconnects after fetching — designed for short-lived serverless invocations.
 */
export async function fetchNewReplies(
  config: ImapConfig,
  since: Date,
): Promise<FetchedReply[]> {
  const password = decryptPassword(config.encryptedPassword);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.user, pass: password },
    logger: false,
  });

  const replies: FetchedReply[] = [];

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    // Search for unseen messages since the cutoff date
    const sinceDate = since.toISOString().slice(0, 10).replace(/-/g, '');
    const searchQuery = { unseen: true };

    const messages = client.fetch(
      { ...searchQuery, since: sinceDate },
      {
        uid: true,
        envelope: true,
        source: true,
        bodyParts: ['text/plain', 'text/html'],
      },
    );

    for await (const msg of messages) {
      try {
        const headers = parseEnvelope(msg.envelope);
        const bodyText = extractTextBody(msg.bodyParts);
        const bodyHtml = extractHtmlBody(msg.bodyParts);

        replies.push({
          uid: msg.uid,
          headers,
          bodyText,
          bodyHtml,
          raw: msg.source ? String(msg.source) : undefined,
          receivedAt: msg.envelope?.date ?? new Date(),
        });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'imap', method: 'fetchNewReplies', uid: String(msg.uid) },
        });
        // Continue processing other messages even if one fails
      }
    }
  } catch (err) {
    console.warn('[imap:fetchNewReplies] connection error', err);
    Sentry.captureException(err, {
      tags: { module: 'imap', method: 'fetchNewReplies' },
    });
    // Return whatever we got before the error
  } finally {
    try {
      await client.logout();
    } catch {
      // Best-effort cleanup
    }
  }

  return replies;
}

/**
 * Verify IMAP connectivity. Returns true if the connection succeeds.
 */
export async function verifyImap(config: ImapConfig): Promise<boolean> {
  const password = decryptPassword(config.encryptedPassword);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.user, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEnvelope(env: unknown): EmailHeaders {
  if (!env || typeof env !== 'object') return {};
  const e = env as Record<string, unknown>;
  return {
    subject: String(e.subject ?? ''),
    from: formatAddress(e.from),
    to: formatAddress(e.to),
    date: e.date instanceof Date ? e.date : undefined,
    messageId: String(e.messageId ?? ''),
    inReplyTo: String(e.inReplyTo ?? ''),
    references: String(e.references ?? ''),
  };
}

function formatAddress(addr: unknown): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (Array.isArray(addr)) {
    return addr
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object') {
          const o = a as { name?: string; address?: string };
          return o.name ? `${o.name} <${o.address}>` : (o.address ?? '');
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof addr === 'object') {
    const o = addr as { name?: string; address?: string };
    return o.name ? `${o.name} <${o.address}>` : (o.address ?? '');
  }
  return String(addr);
}

function extractTextBody(
  parts: Map<string, Buffer> | undefined,
): string {
  if (!parts) return '';
  const entries = Array.from(parts.entries());
  for (const [key, buf] of entries) {
    if (key.includes('text/plain')) {
      return buf.toString('utf-8').trim();
    }
  }
  return '';
}

function extractHtmlBody(
  parts: Map<string, Buffer> | undefined,
): string | undefined {
  if (!parts) return undefined;
  const entries = Array.from(parts.entries());
  for (const [key, buf] of entries) {
    if (key.includes('text/html')) {
      return buf.toString('utf-8').trim();
    }
  }
  return undefined;
}
