/**
 * Tests for email verification logic (pure functions extracted from the route).
 */
import { describe, it, expect } from 'vitest';

// ── Pure helper functions extracted here to make them unit-testable ──────────

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function isValidOtp(input: string): boolean {
  return /^\d{6}$/.test(input);
}

function matchesOtp(stored: string, input: string): boolean {
  return stored === input;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('email verification helpers', () => {
  describe('isExpired', () => {
    it('returns false for a future expiry', () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      expect(isExpired(future)).toBe(false);
    });

    it('returns true for a past expiry', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(isExpired(past)).toBe(true);
    });
  });

  describe('isValidOtp', () => {
    it('accepts exactly 6 digits', () => {
      expect(isValidOtp('123456')).toBe(true);
      expect(isValidOtp('000000')).toBe(true);
    });

    it('rejects non-numeric characters', () => {
      expect(isValidOtp('12345a')).toBe(false);
      expect(isValidOtp('abcdef')).toBe(false);
    });

    it('rejects wrong length', () => {
      expect(isValidOtp('12345')).toBe(false);
      expect(isValidOtp('1234567')).toBe(false);
    });
  });

  describe('matchesOtp', () => {
    it('matches when both are equal', () => {
      expect(matchesOtp('123456', '123456')).toBe(true);
    });

    it('rejects when different', () => {
      expect(matchesOtp('123456', '654321')).toBe(false);
    });
  });
});
