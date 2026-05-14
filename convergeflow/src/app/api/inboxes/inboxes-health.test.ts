/**
 * Tests for inbox health calculation helpers.
 */
import { describe, it, expect } from 'vitest';

// ── Pure helpers extracted for testability ───────────────────────────────────

function warmupProgressPercent(
  warmupStartDate: string | null | undefined,
  targetDays = 30,
): number {
  if (!warmupStartDate) return 0;
  const start = new Date(warmupStartDate);
  if (isNaN(start.getTime())) return 0;
  const elapsed = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(100, Math.round((elapsed / targetDays) * 100));
}

type StatusBadge = 'healthy' | 'warming' | 'warning' | 'error';

function statusBadge(status: string, bounceRate: number): StatusBadge {
  if (status === 'error' || status === 'disconnected') return 'error';
  if (bounceRate > 0.1) return 'warning';
  if (status === 'warming') return 'warming';
  return 'healthy';
}

// ─────────────────────────────────────────────────────────────────────────────

describe('warmupProgressPercent', () => {
  it('returns 0 when warmupStartDate is null', () => {
    expect(warmupProgressPercent(null)).toBe(0);
  });

  it('returns 0 when warmupStartDate is undefined', () => {
    expect(warmupProgressPercent(undefined)).toBe(0);
  });

  it('returns 0 for invalid date', () => {
    expect(warmupProgressPercent('not-a-date')).toBe(0);
  });

  it('returns ~50 when halfway through 30-day warmup', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const pct = warmupProgressPercent(fifteenDaysAgo);
    expect(pct).toBeGreaterThanOrEqual(49);
    expect(pct).toBeLessThanOrEqual(51);
  });

  it('caps at 100 for old warmup start dates', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(warmupProgressPercent(sixtyDaysAgo)).toBe(100);
  });
});

describe('statusBadge', () => {
  it('returns error for disconnected inbox', () => {
    expect(statusBadge('disconnected', 0)).toBe('error');
  });

  it('returns error for error status', () => {
    expect(statusBadge('error', 0)).toBe('error');
  });

  it('returns warning for high bounce rate (>10%)', () => {
    expect(statusBadge('active', 0.15)).toBe('warning');
  });

  it('returns warming for warming status with acceptable bounce rate', () => {
    expect(statusBadge('warming', 0.02)).toBe('warming');
  });

  it('returns healthy for active inbox with low bounce rate', () => {
    expect(statusBadge('active', 0.02)).toBe('healthy');
  });

  it('returns healthy for connected inbox', () => {
    expect(statusBadge('connected', 0)).toBe('healthy');
  });
});
