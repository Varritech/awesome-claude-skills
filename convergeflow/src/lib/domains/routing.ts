/**
 * Multi-domain routing rule evaluation.
 * Rules determine which domain/inbox to use for a given lead.
 */

export type RoutingCondition = 'industry' | 'location' | 'always';

export interface RoutingRule {
  condition: RoutingCondition;
  value: string; // e.g. "SaaS" or "New York" or "" (for 'always')
  domainId: string;
}

export interface RoutingRulesConfig {
  rules: RoutingRule[];
}

export interface LeadContext {
  industry?: string;
  location?: string;
}

/**
 * Evaluates routing rules for a lead and returns the matching domainId.
 * Rules are evaluated in order; first match wins.
 * If no rule matches, returns null (use default domain).
 */
export function evaluateRoutingRules(
  rules: RoutingRule[],
  lead: LeadContext,
): string | null {
  for (const rule of rules) {
    if (rule.condition === 'always') {
      return rule.domainId;
    }

    if (rule.condition === 'industry') {
      const leadIndustry = (lead.industry ?? '').toLowerCase().trim();
      const ruleValue = rule.value.toLowerCase().trim();
      if (leadIndustry && ruleValue && leadIndustry === ruleValue) {
        return rule.domainId;
      }
    }

    if (rule.condition === 'location') {
      const leadLocation = (lead.location ?? '').toLowerCase().trim();
      const ruleValue = rule.value.toLowerCase().trim();
      if (leadLocation && ruleValue && leadLocation.includes(ruleValue)) {
        return rule.domainId;
      }
    }
  }

  return null;
}
