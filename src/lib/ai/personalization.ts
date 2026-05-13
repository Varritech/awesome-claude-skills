/**
 * Personalization engine — injects prospect-specific tokens into email templates.
 * Tokens defined in PRD §5.2.
 */

export interface ProspectContext {
  firstName?: string;
  lastName?: string;
  company?: string;
  city?: string;
  state?: string;
  industry?: string;
  // Dynamic enrichment (Snov / Aleads)
  reviewCount?: number;
  reviewRating?: number;
  hasWebsite?: boolean;
  estimatedSize?: 'solo' | 'small' | 'medium';
  hiringSignal?: boolean;
  recentActivity?: string;
}

export interface CampaignContext {
  senderName: string;
  businessName: string;
  niche: string;          // e.g. "lead gen agency targeting roofers"
  offer: string;          // e.g. "outbound cold email system"
  calendarLink?: string;
}

export interface PersonalizationTokens {
  first_name: string;
  company: string;
  city: string;
  industry: string;
  pain_signal: string;
  case_study_result: string;
  outcome_metric: string;
  cta_ask: string;
  sender_name: string;
}

/** Derive a pain signal from enrichment data. */
function derivePainSignal(prospect: ProspectContext): string {
  if (prospect.reviewCount !== undefined && prospect.reviewCount < 10) {
    return `noticed you don't have many reviews online`;
  }
  if (prospect.hasWebsite === false) {
    return `noticed you don't have a website yet`;
  }
  if (prospect.hiringSignal) {
    return `noticed you're actively hiring, which usually means growth pains`;
  }
  if (prospect.estimatedSize === 'solo') {
    return `noticed you're running a lean operation`;
  }
  return `noticed there might be an opportunity to grow your pipeline`;
}

/** Industry-mapped case study results. */
const CASE_STUDY_MAP: Record<string, { result: string; metric: string }> = {
  roofing: {
    result: 'helped a roofing contractor in Orlando cut $2,400/month from their lead gen costs',
    metric: '3–5 booked roofing jobs per month without ad spend',
  },
  hvac: {
    result: 'helped an HVAC company in Phoenix book 8 new service contracts in 30 days',
    metric: '8 new service contracts in 30 days',
  },
  'real estate': {
    result: 'helped a realtor in Austin book 6 seller consultations in 3 weeks',
    metric: '6 seller consultations in 3 weeks',
  },
  realtor: {
    result: 'helped a realtor in Austin book 6 seller consultations in 3 weeks',
    metric: '6 seller consultations in 3 weeks',
  },
  landscaping: {
    result: 'helped a landscaping company in Denver land 4 commercial contracts worth $18,000',
    metric: '4 commercial contracts, $18,000 in new revenue',
  },
  agency: {
    result: 'helped a lead gen agency reduce cost-per-booked-call from $380 to $42',
    metric: 'cost-per-booked-call reduced from $380 to $42',
  },
};

function getCaseStudy(industry: string): { result: string; metric: string } {
  const key = Object.keys(CASE_STUDY_MAP).find((k) =>
    industry.toLowerCase().includes(k)
  );
  return (
    CASE_STUDY_MAP[key ?? ''] ?? {
      result: 'helped a similar business book 4–6 new clients per month through outbound email',
      metric: '4–6 new booked calls per month',
    }
  );
}

export function buildTokens(
  prospect: ProspectContext,
  campaign: CampaignContext
): PersonalizationTokens {
  const industry = prospect.industry ?? campaign.niche ?? 'business';
  const cs = getCaseStudy(industry);

  return {
    first_name: prospect.firstName ?? 'there',
    company: prospect.company ?? 'your business',
    city: [prospect.city, prospect.state].filter(Boolean).join(', ') || 'your area',
    industry,
    pain_signal: derivePainSignal(prospect),
    case_study_result: cs.result,
    outcome_metric: cs.metric,
    cta_ask: `Would you mind if I sent over 2 times we could talk for 15 minutes?`,
    sender_name: campaign.senderName,
  };
}

/** Replace all {{token}} occurrences in a string. */
export function injectTokens(template: string, tokens: PersonalizationTokens): string {
  return template
    .replace(/\{\{first_name\}\}/g, tokens.first_name)
    .replace(/\{\{company\}\}/g, tokens.company)
    .replace(/\{\{city\}\}/g, tokens.city)
    .replace(/\{\{industry\}\}/g, tokens.industry)
    .replace(/\{\{pain_signal\}\}/g, tokens.pain_signal)
    .replace(/\{\{case_study_result\}\}/g, tokens.case_study_result)
    .replace(/\{\{outcome_metric\}\}/g, tokens.outcome_metric)
    .replace(/\{\{cta_ask\}\}/g, tokens.cta_ask)
    .replace(/\{\{sender_name\}\}/g, tokens.sender_name);
}
