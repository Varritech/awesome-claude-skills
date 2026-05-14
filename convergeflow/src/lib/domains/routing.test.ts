import { describe, it, expect } from 'vitest';
import { evaluateRoutingRules, type RoutingRule } from './routing';

describe('evaluateRoutingRules', () => {
  const saasRule: RoutingRule = { condition: 'industry', value: 'SaaS', domainId: 'dom_saas' };
  const nycRule: RoutingRule = { condition: 'location', value: 'New York', domainId: 'dom_nyc' };
  const alwaysRule: RoutingRule = { condition: 'always', value: '', domainId: 'dom_default' };

  it('returns null when no rules provided', () => {
    expect(evaluateRoutingRules([], { industry: 'SaaS' })).toBeNull();
  });

  it('returns null when no rule matches', () => {
    expect(evaluateRoutingRules([saasRule], { industry: 'Roofing' })).toBeNull();
  });

  it('matches industry rule (case-insensitive)', () => {
    expect(evaluateRoutingRules([saasRule], { industry: 'saas' })).toBe('dom_saas');
    expect(evaluateRoutingRules([saasRule], { industry: 'SAAS' })).toBe('dom_saas');
  });

  it('matches location rule (partial match)', () => {
    expect(evaluateRoutingRules([nycRule], { location: 'New York, NY' })).toBe('dom_nyc');
  });

  it('returns null when lead has no location for location rule', () => {
    expect(evaluateRoutingRules([nycRule], {})).toBeNull();
  });

  it('always rule always matches', () => {
    expect(evaluateRoutingRules([alwaysRule], {})).toBe('dom_default');
    expect(evaluateRoutingRules([alwaysRule], { industry: 'Anything' })).toBe('dom_default');
  });

  it('first matching rule wins', () => {
    const rules: RoutingRule[] = [saasRule, alwaysRule];
    // SaaS lead matches saasRule first
    expect(evaluateRoutingRules(rules, { industry: 'SaaS' })).toBe('dom_saas');
    // Non-SaaS lead falls through to alwaysRule
    expect(evaluateRoutingRules(rules, { industry: 'Retail' })).toBe('dom_default');
  });

  it('location partial match - city included in longer string', () => {
    expect(
      evaluateRoutingRules([nycRule], { location: 'New York City' }),
    ).toBe('dom_nyc');
  });

  it('industry rule does not match empty lead industry', () => {
    expect(evaluateRoutingRules([saasRule], { industry: '' })).toBeNull();
  });
});
