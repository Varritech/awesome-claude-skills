import { describe, it, expect } from 'vitest';
import { getRecommendations, type DeliverabilityMetrics } from './recommendations';

const healthyMetrics: DeliverabilityMetrics = {
  bounceRate: 0.01,
  complaintRate: 0.0005,
  hasDkim: true,
  hasSpf: true,
  hasDmarc: true,
  warmupPercent: 100,
  domain: 'example.com',
  inboxCount: 3,
  avgOpenRate: 0.35,
};

describe('getRecommendations', () => {
  it('returns no critical recommendations for healthy metrics', () => {
    const recs = getRecommendations(healthyMetrics);
    expect(recs.filter((r) => r.severity === 'critical')).toHaveLength(0);
  });

  it('returns critical recommendation when bounce rate > 5%', () => {
    const recs = getRecommendations({ ...healthyMetrics, bounceRate: 0.06 });
    const critical = recs.find((r) => r.id === 'high-bounce-rate');
    expect(critical).toBeDefined();
    expect(critical?.severity).toBe('critical');
  });

  it('does not flag bounce rate at exactly 5%', () => {
    const recs = getRecommendations({ ...healthyMetrics, bounceRate: 0.05 });
    expect(recs.find((r) => r.id === 'high-bounce-rate')).toBeUndefined();
  });

  it('returns critical recommendation when DKIM is missing', () => {
    const recs = getRecommendations({ ...healthyMetrics, hasDkim: false });
    const rec = recs.find((r) => r.id === 'missing-dkim');
    expect(rec).toBeDefined();
    expect(rec?.severity).toBe('critical');
    expect(rec?.title).toContain('DKIM');
  });

  it('includes domain name in DKIM recommendation', () => {
    const recs = getRecommendations({ ...healthyMetrics, hasDkim: false, domain: 'mycompany.io' });
    const rec = recs.find((r) => r.id === 'missing-dkim');
    expect(rec?.title).toContain('mycompany.io');
  });

  it('returns critical recommendation when SPF is missing', () => {
    const recs = getRecommendations({ ...healthyMetrics, hasSpf: false });
    const rec = recs.find((r) => r.id === 'missing-spf');
    expect(rec?.severity).toBe('critical');
  });

  it('returns critical recommendation when complaint rate > 0.1%', () => {
    const recs = getRecommendations({ ...healthyMetrics, complaintRate: 0.002 });
    const rec = recs.find((r) => r.id === 'high-complaint-rate');
    expect(rec?.severity).toBe('critical');
  });

  it('returns warning recommendation when DMARC is missing', () => {
    const recs = getRecommendations({ ...healthyMetrics, hasDmarc: false });
    const rec = recs.find((r) => r.id === 'missing-dmarc');
    expect(rec?.severity).toBe('warning');
  });

  it('returns warning when warmup < 50%', () => {
    const recs = getRecommendations({ ...healthyMetrics, warmupPercent: 30 });
    const rec = recs.find((r) => r.id === 'low-warmup');
    expect(rec?.severity).toBe('warning');
    expect(rec?.description).toContain('30%');
  });

  it('does not add low-warmup warning when warmup is 100%', () => {
    const recs = getRecommendations({ ...healthyMetrics, warmupPercent: 100 });
    expect(recs.find((r) => r.id === 'low-warmup')).toBeUndefined();
  });

  it('returns warning when bounce rate is between 2-5%', () => {
    const recs = getRecommendations({ ...healthyMetrics, bounceRate: 0.03 });
    const rec = recs.find((r) => r.id === 'elevated-bounce-rate');
    expect(rec?.severity).toBe('warning');
  });

  it('returns warning for low open rate', () => {
    const recs = getRecommendations({ ...healthyMetrics, avgOpenRate: 0.05 });
    const rec = recs.find((r) => r.id === 'low-open-rate');
    expect(rec?.severity).toBe('warning');
  });

  it('returns info for warmup in progress (50-99%)', () => {
    const recs = getRecommendations({ ...healthyMetrics, warmupPercent: 75 });
    const rec = recs.find((r) => r.id === 'warmup-in-progress');
    expect(rec?.severity).toBe('info');
    expect(rec?.description).toContain('75%');
  });

  it('returns info for single inbox', () => {
    const recs = getRecommendations({ ...healthyMetrics, inboxCount: 1 });
    const rec = recs.find((r) => r.id === 'single-inbox');
    expect(rec?.severity).toBe('info');
  });

  it('sorts recommendations critical → warning → info', () => {
    const recs = getRecommendations({
      ...healthyMetrics,
      bounceRate: 0.07,
      hasDkim: false,
      hasDmarc: false,
      warmupPercent: 40,
      inboxCount: 1,
    });
    const severities = recs.map((r) => r.severity);
    const criticalEnd = severities.lastIndexOf('critical');
    const warningStart = severities.indexOf('warning');
    const warningEnd = severities.lastIndexOf('warning');
    const infoStart = severities.indexOf('info');
    // All criticals come before warnings, all warnings before infos
    expect(criticalEnd).toBeLessThan(warningStart);
    expect(warningEnd).toBeLessThan(infoStart);
  });

  it('each recommendation has all required fields', () => {
    const recs = getRecommendations({ ...healthyMetrics, hasDkim: false, hasDmarc: false });
    for (const rec of recs) {
      expect(rec.id).toBeTruthy();
      expect(rec.severity).toMatch(/^(critical|warning|info)$/);
      expect(rec.title).toBeTruthy();
      expect(rec.description).toBeTruthy();
      expect(rec.action).toBeTruthy();
    }
  });
});
