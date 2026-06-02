import { describe, it, expect } from 'vitest';
import { next8amUtc } from './schedule';

describe('next8amUtc', () => {
  it('returns today at 08:00 UTC when called before 08:00 UTC', () => {
    const now = new Date('2026-06-02T03:15:00.000Z');
    expect(next8amUtc(now)).toBe('2026-06-02T08:00:00.000Z');
  });

  it('returns tomorrow at 08:00 UTC when called after 08:00 UTC', () => {
    const now = new Date('2026-06-02T10:00:00.000Z');
    expect(next8amUtc(now)).toBe('2026-06-03T08:00:00.000Z');
  });

  it('returns tomorrow at 08:00 UTC when called exactly at 08:00 UTC (boundary)', () => {
    const now = new Date('2026-06-02T08:00:00.000Z');
    expect(next8amUtc(now)).toBe('2026-06-03T08:00:00.000Z');
  });

  it('rolls over the month boundary correctly', () => {
    const now = new Date('2026-05-31T20:00:00.000Z');
    expect(next8amUtc(now)).toBe('2026-06-01T08:00:00.000Z');
  });

  it('rolls over the year boundary correctly', () => {
    const now = new Date('2026-12-31T23:00:00.000Z');
    expect(next8amUtc(now)).toBe('2027-01-01T08:00:00.000Z');
  });

  it('produces the same window for two calls inside the same UTC pre-08:00 morning', () => {
    const a = new Date('2026-06-02T01:00:00.000Z');
    const b = new Date('2026-06-02T07:59:59.999Z');
    expect(next8amUtc(a)).toBe(next8amUtc(b));
  });

  it('produces a different window after the cutoff vs before the cutoff on the same day', () => {
    const before = new Date('2026-06-02T07:59:59.999Z');
    const after = new Date('2026-06-02T08:00:00.001Z');
    expect(next8amUtc(before)).not.toBe(next8amUtc(after));
  });
});
