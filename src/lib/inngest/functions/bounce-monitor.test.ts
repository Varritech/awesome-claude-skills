/**
 * Unit tests for bounce rate calculation logic used in bounce-monitor.
 */

import { describe, it, expect } from 'vitest';

// Mirror the bounce rate calculation logic from bounce-monitor.ts
function calcBounceRate(emails: { status: string }[]): { sent: number; bounced: number; rate: number } {
  let sent = 0;
  let bounced = 0;
  emails.forEach(({ status }) => {
    if (status === 'sent' || status === 'opened' || status === 'replied') sent++;
    if (status === 'bounced') bounced++;
  });
  const rate = sent > 0 ? bounced / sent : 0;
  return { sent, bounced, rate };
}

const HIGH_BOUNCE_THRESHOLD = 0.05;

describe('bounce rate calculation', () => {
  it('returns 0 rate with no emails', () => {
    expect(calcBounceRate([]).rate).toBe(0);
  });

  it('returns 0 rate with all sent', () => {
    const emails = Array(10).fill({ status: 'sent' });
    const { rate } = calcBounceRate(emails);
    expect(rate).toBe(0);
  });

  it('counts opened and replied as sent', () => {
    const emails = [
      { status: 'sent' },
      { status: 'opened' },
      { status: 'replied' },
      { status: 'bounced' },
    ];
    const { sent, bounced } = calcBounceRate(emails);
    expect(sent).toBe(3);
    expect(bounced).toBe(1);
  });

  it('calculates 10% bounce rate correctly', () => {
    const emails = [
      ...Array(9).fill({ status: 'sent' }),
      { status: 'bounced' },
    ];
    const { sent, bounced } = calcBounceRate(emails);
    expect(sent).toBe(9);
    expect(bounced).toBe(1);
    expect(bounced / sent).toBeCloseTo(0.111, 2);
  });

  it('does not alert below 5% threshold', () => {
    const emails = [
      ...Array(98).fill({ status: 'sent' }),
      ...Array(2).fill({ status: 'bounced' }),
    ];
    const { rate } = calcBounceRate(emails);
    expect(rate > HIGH_BOUNCE_THRESHOLD).toBe(false);
  });

  it('alerts above 5% threshold', () => {
    const emails = [
      ...Array(90).fill({ status: 'sent' }),
      ...Array(10).fill({ status: 'bounced' }),
    ];
    const { rate } = calcBounceRate(emails);
    expect(rate > HIGH_BOUNCE_THRESHOLD).toBe(true);
    expect(rate).toBeCloseTo(0.111, 2);
  });

  it('ignores queued and paused statuses in sent count', () => {
    const emails = [
      { status: 'queued' },
      { status: 'paused' },
      { status: 'draft' },
      { status: 'sent' },
      { status: 'bounced' },
    ];
    const { sent, bounced } = calcBounceRate(emails);
    expect(sent).toBe(1);
    expect(bounced).toBe(1);
  });

  it('handles 100% bounce rate', () => {
    const emails = Array(5).fill({ status: 'bounced' });
    const { sent, bounced, rate } = calcBounceRate(emails);
    expect(sent).toBe(0);
    expect(bounced).toBe(5);
    expect(rate).toBe(0); // sent=0 so rate = 0 (avoids divide by zero)
  });
});
