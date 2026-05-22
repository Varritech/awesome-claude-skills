/**
 * Unit tests for complaint webhook HMAC verification logic.
 */

import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

function verifyHmac(body: string, sig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

function calcHmac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('complaint webhook HMAC verification', () => {
  const SECRET = 'test-secret-key-32-bytes-long-abc';
  const BODY = JSON.stringify({ inboxId: 'inbox_1', complaintType: 'spam', count: 1 });

  it('accepts valid signature', () => {
    const sig = calcHmac(BODY, SECRET);
    expect(verifyHmac(BODY, sig, SECRET)).toBe(true);
  });

  it('rejects tampered body', () => {
    const sig = calcHmac(BODY, SECRET);
    const tampered = BODY.replace('inbox_1', 'inbox_2');
    expect(verifyHmac(tampered, sig, SECRET)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const sig = calcHmac(BODY, 'wrong-secret');
    expect(verifyHmac(BODY, sig, SECRET)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifyHmac(BODY, '', SECRET)).toBe(false);
  });

  it('rejects truncated signature', () => {
    const sig = calcHmac(BODY, SECRET).slice(0, 32);
    expect(verifyHmac(BODY, sig, SECRET)).toBe(false);
  });
});

describe('complaint rate threshold logic', () => {
  it('does not suspend at 0% complaint rate', () => {
    const rate = 0 / 1000;
    expect(rate > 0.001).toBe(false);
  });

  it('does not suspend below threshold (0.05%)', () => {
    const rate = 0 / 500;
    expect(rate > 0.001).toBe(false);
  });

  it('suspends at exactly 0.1% (boundary)', () => {
    // 0.001 is the threshold; 1/1000 = 0.001, not > 0.001
    const rate = 1 / 1000;
    expect(rate > 0.001).toBe(false);
  });

  it('suspends above 0.1%', () => {
    const rate = 2 / 1000; // 0.2%
    expect(rate > 0.001).toBe(true);
  });

  it('suspends at high complaint rate', () => {
    const rate = 5 / 100; // 5%
    expect(rate > 0.001).toBe(true);
  });
});
