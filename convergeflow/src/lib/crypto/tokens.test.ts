import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken } from './tokens';

const MOCK_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('encryptToken / decryptToken', () => {
  beforeEach(() => {
    process.env.SMTP_ENCRYPTION_KEY = MOCK_KEY;
  });

  afterEach(() => {
    delete process.env.SMTP_ENCRYPTION_KEY;
  });

  it('round-trips a token: encrypt then decrypt returns original', () => {
    const plain = 'ya29.access-token-12345';
    const encrypted = encryptToken(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });

  it('produces different ciphertexts for same input (random IV)', () => {
    const plain = 'same-token';
    const enc1 = encryptToken(plain);
    const enc2 = encryptToken(plain);
    expect(enc1).not.toBe(enc2);
    // but both decrypt to the same value
    expect(decryptToken(enc1)).toBe(plain);
    expect(decryptToken(enc2)).toBe(plain);
  });

  it('encrypted format is iv:tag:ciphertext (3 colon-separated parts)', () => {
    const encrypted = encryptToken('token');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // iv is 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // tag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
  });

  it('throws when key env var is missing', () => {
    delete process.env.SMTP_ENCRYPTION_KEY;
    expect(() => encryptToken('test')).toThrow('SMTP_ENCRYPTION_KEY');
  });

  it('throws when decrypting malformed ciphertext', () => {
    expect(() => decryptToken('notvalid')).toThrow('Invalid encrypted token format');
  });
});
