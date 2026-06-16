/**
 * SMTP mailer — wraps Nodemailer with per-inbox SMTP credentials.
 *
 * Passwords are stored encrypted in Firestore (AES-256-GCM).
 * Set SMTP_ENCRYPTION_KEY (32-byte hex) in Vercel env.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_ENV = 'SMTP_ENCRYPTION_KEY';

function encryptionKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(`${KEY_ENV} must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32`);
  }
  return Buffer.from(hex, 'hex');
}

// ─── Password encryption ──────────────────────────────────────────────────────

export function encryptPassword(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(stored: string): string {
  const key = encryptionKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted password format');
  const [ivHex, tagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

// ─── Transporter pool (cached per connection string) ─────────────────────────

const _pool = new Map<string, Transporter>();

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  encryptedPassword: string; // stored encrypted form
}

function poolKey(cfg: SmtpConfig) {
  return `${cfg.host}:${cfg.port}:${cfg.user}`;
}

export function getTransporter(cfg: SmtpConfig): Transporter {
  const key = poolKey(cfg);
  if (_pool.has(key)) return _pool.get(key)!;

  const password = decryptPassword(cfg.encryptedPassword);
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: password },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,  // 1 message per second max per connection
    rateLimit: 1,
  });

  _pool.set(key, t);
  return t;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export interface SendOptions {
  from: string;       // "Name <email@domain.com>"
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  messageId?: string; // for threading
  headers?: Record<string, string>;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export async function sendEmail(cfg: SmtpConfig, opts: SendOptions): Promise<SendResult> {
  const transporter = getTransporter(cfg);
  const info = await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? htmlToText(opts.html),
    replyTo: opts.replyTo,
    messageId: opts.messageId,
    headers: {
      'X-Mailer': 'ConvergeFlow/1.0',
      'X-Campaign-Id': opts.headers?.['X-Campaign-Id'] ?? '',
      ...opts.headers,
    },
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted as string[],
    rejected: info.rejected as string[],
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ─── Verify connectivity ──────────────────────────────────────────────────────

export async function verifySmtp(cfg: SmtpConfig): Promise<boolean> {
  try {
    const t = getTransporter(cfg);
    await t.verify();
    return true;
  } catch {
    return false;
  }
}
