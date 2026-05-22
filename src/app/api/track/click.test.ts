/**
 * Unit tests for click-tracking URL validation logic.
 * Tests the pure `isAllowedUrl`-equivalent logic without Firestore.
 */

import { describe, it, expect } from 'vitest';

// Re-implement the pure URL validation logic for testing (mirrors route logic)
function isAllowedUrlSync(
  targetUrl: string,
  appUrl: string,
  verifiedDomains: string[] = [],
): { allowed: boolean; reason: string } {
  if (!appUrl) return { allowed: false, reason: 'no appUrl' };

  let parsed: URL;
  try {
    parsed = new URL(targetUrl, appUrl);
  } catch {
    return { allowed: false, reason: 'invalid url' };
  }

  if (parsed.origin === new URL(appUrl).origin) {
    return { allowed: true, reason: 'same-origin' };
  }

  if (verifiedDomains.includes(parsed.hostname)) {
    return { allowed: true, reason: 'tracking-domain' };
  }

  return { allowed: false, reason: 'not allowed' };
}

const APP_URL = 'https://app.convergeflow.io';

describe('click tracking URL validation', () => {
  it('allows same-origin absolute URL', () => {
    const r = isAllowedUrlSync('https://app.convergeflow.io/dashboard', APP_URL);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('same-origin');
  });

  it('allows relative path resolved against app origin', () => {
    const r = isAllowedUrlSync('/unsubscribe?token=abc', APP_URL);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('same-origin');
  });

  it('blocks external domain not in tracking list', () => {
    const r = isAllowedUrlSync('https://evil.com/phish', APP_URL);
    expect(r.allowed).toBe(false);
  });

  it('allows verified tracking domain', () => {
    const r = isAllowedUrlSync('https://track.acme.com/click', APP_URL, ['track.acme.com']);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('tracking-domain');
  });

  it('blocks unverified tracking domain', () => {
    const r = isAllowedUrlSync('https://track.evil.com/click', APP_URL, ['track.acme.com']);
    expect(r.allowed).toBe(false);
  });

  it('resolves relative-looking malformed URL against app origin (same-origin pass)', () => {
    // new URL('not a url !!', base) resolves as relative path → same origin
    const r = isAllowedUrlSync('not a url !!', APP_URL);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('same-origin');
  });

  it('blocks truly external malformed URL', () => {
    const r = isAllowedUrlSync('https://evil.co/path?foo=bar', APP_URL);
    expect(r.allowed).toBe(false);
  });

  it('blocks javascript: protocol', () => {
    const r = isAllowedUrlSync('javascript:alert(1)', APP_URL);
    // javascript: parsed as relative, origin = 'null', not same as app
    expect(r.allowed).toBe(false);
  });

  it('returns not-allowed when no appUrl configured', () => {
    const r = isAllowedUrlSync('https://app.convergeflow.io/dash', '');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('no appUrl');
  });
});
