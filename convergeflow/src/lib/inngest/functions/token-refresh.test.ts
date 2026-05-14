/**
 * Tests for OAuth token refresh helpers.
 * The Inngest function itself is integration-level; we test the pure logic here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const MOCK_KEY = 'b'.repeat(64);

// ── Pure token expiry helpers ────────────────────────────────────────────────

function needsRefresh(tokenExpiresAt: string | undefined, thresholdMs = 24 * 60 * 60 * 1000): boolean {
  if (!tokenExpiresAt) return false;
  return new Date(tokenExpiresAt).getTime() < Date.now() + thresholdMs;
}

function isOAuthProvider(provider: string): provider is 'gmail' | 'outlook' {
  return provider === 'gmail' || provider === 'outlook';
}

// ─────────────────────────────────────────────────────────────────────────────

describe('token refresh helpers', () => {
  describe('needsRefresh', () => {
    it('returns true when token expires within threshold', () => {
      const soon = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1h from now
      expect(needsRefresh(soon)).toBe(true);
    });

    it('returns false when token expires after threshold', () => {
      const far = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h from now
      expect(needsRefresh(far)).toBe(false);
    });

    it('returns true for already-expired token', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(needsRefresh(past)).toBe(true);
    });

    it('returns false when tokenExpiresAt is undefined', () => {
      expect(needsRefresh(undefined)).toBe(false);
    });
  });

  describe('isOAuthProvider', () => {
    it('returns true for gmail', () => {
      expect(isOAuthProvider('gmail')).toBe(true);
    });

    it('returns true for outlook', () => {
      expect(isOAuthProvider('outlook')).toBe(true);
    });

    it('returns false for smtp_imap', () => {
      expect(isOAuthProvider('smtp_imap')).toBe(false);
    });

    it('returns false for unknown provider', () => {
      expect(isOAuthProvider('yahoo')).toBe(false);
    });
  });
});

describe('encryptToken / decryptToken integration (for refresh storage)', () => {
  beforeEach(() => {
    process.env.SMTP_ENCRYPTION_KEY = MOCK_KEY;
  });

  afterEach(() => {
    delete process.env.SMTP_ENCRYPTION_KEY;
  });

  it('correctly round-trips an OAuth access token', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/crypto/tokens');
    const token = 'ya29.access-token-abc123';
    expect(decryptToken(encryptToken(token))).toBe(token);
  });
});
