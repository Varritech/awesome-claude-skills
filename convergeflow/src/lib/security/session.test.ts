import { describe, it, expect } from 'vitest';
import {
  SESSION_TIMEOUT_MS,
  SESSION_WARNING_MS,
  isSessionExpired,
  isSessionExpiringSoon,
  msUntilExpiry,
} from './session';

describe('session timeout constants', () => {
  it('SESSION_TIMEOUT_MS is 30 minutes', () => {
    expect(SESSION_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('SESSION_WARNING_MS is 2 minutes before timeout', () => {
    expect(SESSION_WARNING_MS).toBe(SESSION_TIMEOUT_MS - 2 * 60 * 1000);
  });
});

describe('isSessionExpired', () => {
  it('returns false when session is active (activity 5 min ago)', () => {
    const lastActivity = Date.now() - 5 * 60 * 1000;
    expect(isSessionExpired(lastActivity)).toBe(false);
  });

  it('returns true when session expired (activity 31 min ago)', () => {
    const lastActivity = Date.now() - 31 * 60 * 1000;
    expect(isSessionExpired(lastActivity)).toBe(true);
  });

  it('returns true at exactly the timeout boundary', () => {
    const lastActivity = Date.now() - SESSION_TIMEOUT_MS;
    expect(isSessionExpired(lastActivity)).toBe(true);
  });

  it('returns false just before timeout', () => {
    const lastActivity = Date.now() - (SESSION_TIMEOUT_MS - 1);
    expect(isSessionExpired(lastActivity)).toBe(false);
  });

  it('accepts a custom nowMs parameter', () => {
    const lastActivity = 0;
    const tooOld = SESSION_TIMEOUT_MS + 1;
    expect(isSessionExpired(lastActivity, tooOld)).toBe(true);
  });
});

describe('isSessionExpiringSoon', () => {
  it('returns false when session is fresh', () => {
    const lastActivity = Date.now() - 5 * 60 * 1000;
    expect(isSessionExpiringSoon(lastActivity)).toBe(false);
  });

  it('returns true within the warning window (29 min elapsed)', () => {
    const lastActivity = Date.now() - 29 * 60 * 1000;
    expect(isSessionExpiringSoon(lastActivity)).toBe(true);
  });

  it('returns false after session already expired', () => {
    const lastActivity = Date.now() - 31 * 60 * 1000;
    expect(isSessionExpiringSoon(lastActivity)).toBe(false);
  });
});

describe('msUntilExpiry', () => {
  it('returns ~SESSION_TIMEOUT_MS for fresh session', () => {
    const lastActivity = Date.now();
    const remaining = msUntilExpiry(lastActivity);
    expect(remaining).toBeGreaterThan(SESSION_TIMEOUT_MS - 100);
    expect(remaining).toBeLessThanOrEqual(SESSION_TIMEOUT_MS);
  });

  it('returns 0 for expired session', () => {
    const lastActivity = Date.now() - 35 * 60 * 1000;
    expect(msUntilExpiry(lastActivity)).toBe(0);
  });

  it('returns ~2 minutes when warning window starts', () => {
    const lastActivity = Date.now() - SESSION_WARNING_MS;
    const remaining = msUntilExpiry(lastActivity);
    expect(remaining).toBeLessThanOrEqual(2 * 60 * 1000 + 100);
    expect(remaining).toBeGreaterThan(0);
  });
});
