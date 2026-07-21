/**
 * Rule-based auto-reply / out-of-office detector.
 *
 * Runs before the AI classifier to short-circuit obvious automated replies.
 * These heuristics are cheap, deterministic, and catch ~95% of auto-replies
 * without burning an AI call.
 */

import type { EmailHeaders } from '@/lib/imap/client';

/**
 * Returns true if the email is almost certainly an automated reply
 * (out-of-office, vacation responder, mailer-daemon, etc.).
 */
export function isAutoReply(headers: EmailHeaders, body: string): boolean {
  // ── Header-based signals ──────────────────────────────────────────────────
  if (hasAutoReplyHeaders(headers)) return true;

  // ── Subject-based signals ──────────────────────────────────────────────────
  if (hasAutoReplySubject(headers.subject)) return true;

  // ── Body-based signals ────────────────────────────────────────────────────
  if (hasAutoReplyBody(body)) return true;

  // ── Bounce / mailer-daemon signals ─────────────────────────────────────────
  if (isBounceOrDaemon(headers)) return true;

  return false;
}

/**
 * Returns a human-readable reason if the message was detected as auto-reply,
 * or null if it looks like a real human reply.
 */
export function autoReplyReason(
  headers: EmailHeaders,
  body: string,
): string | null {
  if (hasAutoReplyHeaders(headers)) return 'auto-reply headers detected';
  if (hasAutoReplySubject(headers.subject)) return 'auto-reply subject pattern';
  if (hasAutoReplyBody(body)) return 'auto-reply body pattern';
  if (isBounceOrDaemon(headers)) return 'bounce or mailer-daemon';
  return null;
}

// ─── Header checks ───────────────────────────────────────────────────────────

const AUTO_HEADERS: Array<[string, RegExp]> = [
  ['auto-submitted', /auto-(replied|generated|notified)/i],
  ['x-autoreply', /yes/i],
  ['x-autorespond', /./],
  ['precedence', /^(auto_reply|bulk|junk|list)$/i],
  ['x-mailer', /^(out-of-office|vacation|auto)/i],
  ['x-auto-response-suppress', /(OOF|AutoReply|All)/i],
  ['x-out-of-office', /./],
  ['x-vacation', /./],
];

function hasAutoReplyHeaders(headers: EmailHeaders): boolean {
  for (const [key, pattern] of AUTO_HEADERS) {
    const value = headers[key];
    if (value === undefined) continue;
    const str = Array.isArray(value) ? value.join(' ') : String(value);
    if (pattern.test(str)) return true;
  }
  return false;
}

// ─── Subject checks ──────────────────────────────────────────────────────────

const AUTO_SUBJECT_PATTERNS = [
  /^automatic\s+reply/i,
  /^auto\s*[:\-]\s*/i,
  /^out\s+of\s+office/i,
  /^vacation\s*(responder|reply|auto)/i,
  /^away\s+from\s+(my\s+)?(desk|office)/i,
  /^on\s+(vacation|leave|holiday)/i,
  /^re:\s*out\s+of\s+office/i,
  /^re:\s*automatic\s+reply/i,
];

function hasAutoReplySubject(subject?: string): boolean {
  if (!subject) return false;
  return AUTO_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

// ─── Body checks ─────────────────────────────────────────────────────────────

const AUTO_BODY_PATTERNS = [
  /i\s+(am|'m)\s+currently\s+(out\s+of\s+the\s+office|away|on\s+(vacation|leave|holiday))/i,
  /i\s+will\s+(be\s+back|return)\s+(on|in|after)/i,
  /i\s+am\s+(out\s+of\s+the\s+office|away\s+from\s+my\s+desk|on\s+(vacation|leave))/i,
  /thank\s+you\s+for\s+(your|the)\s+(email|message).+out\s+of\s+(the\s+)?office/i,
  /this\s+is\s+an?\s+(automated|automatic)\s+(reply|response|message)/i,
  /i\s+have\s+limited\s+(or\s+no\s+)?access\s+to\s+(my\s+)?email/i,
  /will\s+respond\s+(to\s+your\s+message\s+)?(upon|when|as\s+soon\s+as)\s+(my\s+)?return/i,
];

function hasAutoReplyBody(body: string): boolean {
  if (!body) return false;
  // Only check the first 500 chars — auto-reply signals are always at the top
  const head = body.slice(0, 500);
  return AUTO_BODY_PATTERNS.some((p) => p.test(head));
}

// ─── Bounce / daemon checks ──────────────────────────────────────────────────

function isBounceOrDaemon(headers: EmailHeaders): boolean {
  const from = String(headers.from ?? '');
  const returnPath = String(headers['return-path'] ?? '');
  const contentType = String(headers['content-type'] ?? '');

  if (/mailer[-\s]?daemon/i.test(from)) return true;
  if (/mailer[-\s]?daemon/i.test(returnPath)) return true;
  if (/postmaster@/i.test(from)) return true;
  if (/^multipart\/report/i.test(contentType)) return true; // DSN bounce

  return false;
}
