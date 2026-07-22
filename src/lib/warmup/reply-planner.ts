/**
 * Pure helpers for the warmup-pool reply loop.
 *
 * When a warmup email (sent from a user's inbox to a pool address) lands at the
 * Resend Inbound webhook, we reply back to the sender so Gmail sees engagement
 * on the warmup thread. This module is the testable seam: it identifies pool
 * recipients and builds the reply content (deterministic body cycling). The
 * Inngest `warmup-reply` function handles the randomized delay + Resend send.
 *
 * NOTE: a Resend pool has no spam folder, so there is no "mark not spam" step
 * here — that signal only exists at real consumer mailboxes. This reply loop
 * provides the *engagement* signal (a reply lands back in the sender's Gmail).
 */

export const WARMUP_REPLY_BODIES = [
  "Thanks for reaching out — looking forward to connecting.",
  "Got it, appreciate the note. I'll get back to you shortly.",
  "Thanks! Happy to chat when you have a few minutes.",
  "Appreciate you following up. Let me take a look and circle back.",
  "Thanks for the message — sounds good on my end.",
  "Got your note. Let's touch base later this week.",
  "Much appreciated — I'll review and reply soon.",
  "Thanks, that's helpful. Talk soon.",
];

export interface InboundWarmupMail {
  from: string;          // the sending inbox (e.g. christian@christianvarriale.com)
  toRecipient: string;   // the pool address that received it
  subject: string;
  messageId: string;     // Message-ID of the warmup email we sent
}

export interface PlannedReply {
  from: string;          // pool address (reply comes from the receiver)
  to: string;            // original sender
  subject: string;       // "Re: <subject>"
  text: string;
  html: string;
  headers: {
    "In-Reply-To": string;
    References: string;
    "X-Convergeflow-Warmup": "1";
  };
  bodyIndex: number;
}

/** Returns the pool address if any `to` recipient is in the pool, else null. */
export function matchWarmupPoolRecipient(
  to: string[],
  pool: string[],
): string | null {
  const poolSet = new Set(pool.map((a) => a.toLowerCase().trim()));
  for (const addr of to) {
    const norm = addr.toLowerCase().trim();
    // pool entries are bare addresses; Resend `to` may be bare too.
    const match = poolSet.has(norm);
    if (match) return pool.find((p) => p.toLowerCase().trim() === norm) ?? addr;
  }
  return null;
}

/** Stable hash → non-negative int (djb2). Used to cycle reply bodies deterministically. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function reSubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^re:\s*/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

export function buildWarmupReply(inbound: InboundWarmupMail): PlannedReply {
  const bodyIndex = hash(inbound.messageId) % WARMUP_REPLY_BODIES.length;
  const text = WARMUP_REPLY_BODIES[bodyIndex]!;
  const messageId = inbound.messageId;
  return {
    from: inbound.toRecipient,
    to: inbound.from,
    subject: reSubject(inbound.subject),
    text,
    html: `<p>${text}</p>`,
    headers: {
      "In-Reply-To": messageId,
      References: messageId,
      "X-Convergeflow-Warmup": "1",
    },
    bodyIndex,
  };
}