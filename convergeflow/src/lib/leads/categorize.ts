/**
 * AI categorization of pulled leads into a trade category.
 *
 * Each freshly-pulled lead gets a provisional category from
 * `mapProviderIndustryToTrade()` (cheap, no AI), then an async Inngest job
 * asks the LLM to confirm/refine it — optionally feeding a website crawl
 * excerpt so the model can tell roofing from gutters from solar by what the
 * company actually does.
 *
 * LinkedIn is auth-walled and is NOT crawled; we pass the provider-supplied
 * title/company/industry + linkedinUrl as metadata only.
 */

export interface CategorizeLeadInput {
  company?: string;
  title?: string;
  industry?: string;
  linkedinUrl?: string;
  website?: string;
}

export interface ParsedCategory {
  category: string;
  confidence: number; // 0-1
  reasoning: string;
}

// Canonical trades → regexes that match provider industry strings.
const TRADE_RULES: Array<{ trade: string; re: RegExp }> = [
  { trade: 'Roofing', re: /\broof/i },
  { trade: 'Gutters', re: /\bgutter/i },
  { trade: 'Solar', re: /\bsolar/i },
  { trade: 'HVAC', re: /\b(hvac|heating|cooling|air cond)/i },
  { trade: 'Plumbing', re: /\bplumb/i },
  { trade: 'Windows', re: /\bwindow/i },
  { trade: 'Siding', re: /\bsiding/i },
  { trade: 'Electrical', re: /\b(electric|elec)\b/i },
  { trade: 'Landscaping', re: /\b(landscape|lawn|yard)\b/i },
  { trade: 'Pest Control', re: /\bpest/i },
  { trade: 'Painting', re: /\bpaint/i },
];

/**
 * Best-guess trade from the provider industry string — used as the
 * provisional category before the AI categorization job runs.
 */
export function mapProviderIndustryToTrade(industry?: string): string {
  if (!industry || !industry.trim()) return 'Other';
  for (const { trade, re } of TRADE_RULES) {
    if (re.test(industry)) return trade;
  }
  // Unknown industry → title-case the raw value so it still surfaces as its
  // own chip rather than being bucketed into "Other".
  return industry.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

const SYSTEM_PROMPT = `You are a lead categorization engine for a home-services sales tool.
Given a lead's company, title, industry, LinkedIn URL, and (when available) an excerpt from their website, decide which single trade category they belong to.

Categories: Roofing, Gutters, Solar, HVAC, Plumbing, Windows, Siding, Electrical, Landscaping, Pest Control, Painting, Other.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"category":"<one of the categories>","confidence":<0-1>,"reasoning":"<one short sentence>"}`;

export function buildCategorizePrompt(
  lead: CategorizeLeadInput,
  websiteExcerpt?: string | null,
): { system: string; user: string } {
  const lines: string[] = [];
  if (lead.company) lines.push(`Company: ${lead.company}`);
  if (lead.title) lines.push(`Title: ${lead.title}`);
  if (lead.industry) lines.push(`Industry: ${lead.industry}`);
  if (lead.linkedinUrl) lines.push(`LinkedIn: ${lead.linkedinUrl}`);
  if (lead.website) lines.push(`Website: ${lead.website}`);
  if (websiteExcerpt) lines.push(`Website excerpt:\n${websiteExcerpt.slice(0, 2000)}`);
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}

/** Parse the LLM's category response. Tolerant of fences/prose; clamps confidence. */
export function parseCategory(raw: string): ParsedCategory {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const category = typeof obj.category === 'string' ? obj.category.trim() : '';
      const confidence = clamp01(toNumber(obj.confidence));
      const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning.trim() : '';
      if (category) return { category, confidence, reasoning };
    } catch {
      // fall through
    }
  }
  return { category: '', confidence: 0, reasoning: raw.trim().slice(0, 200) };
}

function toNumber(v: unknown): number {
  return typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : 0;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}