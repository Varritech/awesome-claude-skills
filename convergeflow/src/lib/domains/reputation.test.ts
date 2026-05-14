import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Pure score calculation logic ─────────────────────────────────────────────
// Extracted from reputation.ts to be testable without DNS

function calculateScore(checks: {
  mxValid: boolean;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  age?: number;
}): number {
  let score = 0;
  if (checks.mxValid) score += 20;
  if (checks.spfValid) score += 20;
  if (checks.dkimValid) score += 20;
  if (checks.dmarcValid) score += 20;
  if (checks.age !== undefined) {
    score += Math.min(20, Math.floor((checks.age / 365) * 20));
  }
  return Math.min(100, score);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('domain reputation score calculation', () => {
  it('returns 0 for domain with no records and no age', () => {
    expect(
      calculateScore({ mxValid: false, spfValid: false, dkimValid: false, dmarcValid: false }),
    ).toBe(0);
  });

  it('returns 80 when all DNS checks pass but no age info', () => {
    expect(
      calculateScore({ mxValid: true, spfValid: true, dkimValid: true, dmarcValid: true }),
    ).toBe(80);
  });

  it('returns 100 when all DNS checks pass and domain is 365+ days old', () => {
    expect(
      calculateScore({ mxValid: true, spfValid: true, dkimValid: true, dmarcValid: true, age: 365 }),
    ).toBe(100);
  });

  it('gives partial age bonus for domains younger than a year', () => {
    const score = calculateScore({
      mxValid: true,
      spfValid: true,
      dkimValid: true,
      dmarcValid: true,
      age: 180,
    });
    // 80 base + floor(180/365 * 20) = 80 + 9 = 89
    expect(score).toBe(89);
  });

  it('caps age bonus at 20 for very old domains', () => {
    expect(
      calculateScore({ mxValid: true, spfValid: true, dkimValid: true, dmarcValid: true, age: 3650 }),
    ).toBe(100);
  });

  it('returns 20 for MX-only domain', () => {
    expect(
      calculateScore({ mxValid: true, spfValid: false, dkimValid: false, dmarcValid: false }),
    ).toBe(20);
  });

  it('each DNS check contributes 20 points', () => {
    expect(calculateScore({ mxValid: true, spfValid: false, dkimValid: false, dmarcValid: false })).toBe(20);
    expect(calculateScore({ mxValid: false, spfValid: true, dkimValid: false, dmarcValid: false })).toBe(20);
    expect(calculateScore({ mxValid: false, spfValid: false, dkimValid: true, dmarcValid: false })).toBe(20);
    expect(calculateScore({ mxValid: false, spfValid: false, dkimValid: false, dmarcValid: true })).toBe(20);
  });
});

describe('getDomainReputation (mocked DNS)', () => {
  beforeEach(() => {
    vi.mock('dns', async (importOriginal) => {
      const actual = await importOriginal<typeof import('dns')>();
      return {
        ...actual,
        promises: {
          resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]),
          resolveTxt: vi.fn().mockImplementation((host: string) => {
            if (host.includes('_dmarc')) return Promise.resolve([['v=DMARC1; p=none']]);
            if (host.includes('_domainkey')) return Promise.resolve([['v=DKIM1; k=rsa; p=abc']]);
            return Promise.resolve([['v=spf1 include:example.com ~all']]);
          }),
        },
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all valid checks when DNS records are present', async () => {
    const { getDomainReputation } = await import('./reputation');
    const rep = await getDomainReputation('example.com');
    expect(rep.mxValid).toBe(true);
    expect(rep.spfValid).toBe(true);
    expect(rep.dkimValid).toBe(true);
    expect(rep.dmarcValid).toBe(true);
    expect(rep.reputationScore).toBeGreaterThanOrEqual(80);
  });
});
