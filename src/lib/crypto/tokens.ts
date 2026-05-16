/**
 * Token encryption helpers for OAuth tokens stored in Firestore.
 * Uses AES-256-GCM (same algorithm as smtp/mailer.ts password encryption).
 * Format: iv:tag:ciphertext (all hex)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_ENV = 'SMTP_ENCRYPTION_KEY';

function encryptionKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32`,
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
  const key = encryptionKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, tagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
