/**
 * RAG Knowledge Base — ConvergeFlow AI Email Engine
 *
 * Framework rules seeded from: Hormozi, Andy Elliott, Jordan Belfort, Sam Ovens.
 * Each chunk is a discrete rule or template that gets embedded and retrieved
 * at generation time to guide the LLM prompt.
 */

export interface KnowledgeChunk {
  id: string;
  framework: 'hormozi' | 'andy_elliott' | 'belfort' | 'sam_ovens' | 'example';
  type: 'rule' | 'template' | 'example' | 'tone_guide';
  industry?: string; // optional industry tag for filtered retrieval
  text: string;
  tags: string[];
}

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  // ─── HORMOZI ──────────────────────────────────────────────────────────────
  {
    id: 'hormozi-001',
    framework: 'hormozi',
    type: 'rule',
    text: 'Send broad — do NOT segment by assumed demographics. Cold email volume > precision. Hormozi principle: "shaking the tree" pulls forward churn, which is good. Unsubscribes on first send are expected and healthy.',
    tags: ['volume', 'segmentation', 'cadence'],
  },
  {
    id: 'hormozi-002',
    framework: 'hormozi',
    type: 'rule',
    text: 'Value-before-ask cadence: establish value and goodwill in Emails 1–3 before making a direct ask. Think of it as making deposits before withdrawals. Never open with an ask in Email 1.',
    tags: ['cadence', 'value-first', 'sequencing'],
  },
  {
    id: 'hormozi-003',
    framework: 'hormozi',
    type: 'rule',
    text: 'Repeat the ask without apology. People get busy. Following up 4–5 times is not spam — it is professional persistence. Email 4 makes a direct ask. Email 5 is the break-up. Never apologize for following up.',
    tags: ['follow-up', 'persistence', 'direct-ask'],
  },
  {
    id: 'hormozi-004',
    framework: 'hormozi',
    type: 'rule',
    text: 'Plain text emails outperform HTML for cold outreach. No images, no logos, no formatting. Write like a real human sending a personal email. This dramatically improves deliverability and reply rates.',
    tags: ['deliverability', 'plain-text', 'format'],
  },
  {
    id: 'hormozi-005',
    framework: 'hormozi',
    type: 'rule',
    text: 'Email 3 provides genuine value — a tip, insight, or framework — that helps the prospect even if they never buy. The CTA is embedded at the end, secondary to the value. "Deposit goodwill before opening the valve."',
    tags: ['value-content', 'email-3', 'embedded-cta'],
  },

  // ─── ANDY ELLIOTT ─────────────────────────────────────────────────────────
  {
    id: 'andy-001',
    framework: 'andy_elliott',
    type: 'rule',
    text: 'Cold email 3-part formula: (1) Compliment or acknowledgment — recognize something real about their business. (2) Case Study — specific result ($X saved, Y jobs booked) from a similar client. (3) CTA — low friction, time-bounded ask (15 minutes). Never exceed 3–6 sentences total.',
    tags: ['structure', '3-part-formula', 'case-study', 'email-2'],
  },
  {
    id: 'andy-002',
    framework: 'andy_elliott',
    type: 'rule',
    text: 'Subject lines: create curiosity, never reveal too much. Good: "I saved a roofer $2,400/mo". Bad: "Cold email marketing services for roofing businesses". The subject line should make them curious enough to open — nothing more.',
    tags: ['subject-line', 'curiosity', 'open-rate'],
  },
  {
    id: 'andy-003',
    framework: 'andy_elliott',
    type: 'rule',
    text: 'Email 5 (break-up): creates finality and urgency without pressure. State you will stop reaching out. Leave the door permanently open. "If this ever becomes relevant, you have my contact." Never burn a lead.',
    tags: ['break-up', 'email-5', 'finality'],
  },
  {
    id: 'andy-004',
    framework: 'andy_elliott',
    type: 'rule',
    text: 'Case study specificity rule: always include a real number ($2,400/mo, 3–5 jobs/month, 47 new leads). Generic claims ("we help businesses grow") have near-zero response. Specific results build instant credibility.',
    tags: ['case-study', 'specificity', 'credibility'],
  },

  // ─── BELFORT (STRAIGHT LINE) ───────────────────────────────────────────────
  {
    id: 'belfort-001',
    framework: 'belfort',
    type: 'rule',
    text: 'Email 1 is rapport only — zero ask. Belfort rapport principle: build conscious buy-in (acknowledge their work, no desperation) and unconscious trust (short, confident tone). The goal of Email 1 is to not be deleted. Nothing else.',
    tags: ['rapport', 'email-1', 'trust-building', 'no-ask'],
  },
  {
    id: 'belfort-002',
    framework: 'belfort',
    type: 'rule',
    text: 'Tone progression across sequence: Email 1 = warm/friendly, Email 2 = professional/helpful, Email 3 = expert/insightful, Email 4 = direct/confident, Email 5 = respectful/final. Never desperate, never pushy.',
    tags: ['tone', 'progression', 'sequence'],
  },
  {
    id: 'belfort-003',
    framework: 'belfort',
    type: 'rule',
    text: 'Straight Line principle: every email moves the prospect one step closer to a yes. Email 1 = open door. Email 2 = establish credibility. Email 3 = build desire. Email 4 = ask for commitment. Email 5 = close or release.',
    tags: ['straight-line', 'progression', 'conversion'],
  },

  // ─── SAM OVENS ────────────────────────────────────────────────────────────
  {
    id: 'ovens-001',
    framework: 'sam_ovens',
    type: 'rule',
    text: 'Funnel stage mapping: Hunt (new cold lead) → Advance (opened/soft interest) → Farm (not right now / 30-day re-touch) → Close (positive reply / booking call). Each stage requires different messaging intensity.',
    tags: ['funnel', 'stages', 'hunt-advance-farm-close'],
  },
  {
    id: 'ovens-002',
    framework: 'sam_ovens',
    type: 'rule',
    text: 'The 15-minute call is the ONLY conversion goal of cold email. Do not pitch the service in the email. Pitch the call. Everything in the sequence exists to book one 15-minute conversation.',
    tags: ['cta', 'conversion-goal', '15-min-call'],
  },
  {
    id: 'ovens-003',
    framework: 'sam_ovens',
    type: 'rule',
    text: 'Farm sequence for soft negatives: re-touch in 30 days with a different angle. Do not repeat the same message. Use a new case study, a new value insight, or a market-relevant observation to re-engage.',
    tags: ['farm', 'soft-negative', 're-engagement'],
  },

  // ─── SEQUENCE TEMPLATES ────────────────────────────────────────────────────
  {
    id: 'template-email1',
    framework: 'belfort',
    type: 'template',
    text: `EMAIL 1 TEMPLATE (Day 0 — Rapport, no ask):
Subject: {{city}} {{industry}} crews

Hi {{first_name}},

Came across {{company}} — you're clearly doing solid work down in {{city}}.

Just wanted to reach out. No pitch today.

{{sender_name}}

RULES: Under 4 sentences. Name + city only. Zero ask. Confident, not needy.`,
    tags: ['email-1', 'template', 'rapport'],
  },
  {
    id: 'template-email2',
    framework: 'andy_elliott',
    type: 'template',
    text: `EMAIL 2 TEMPLATE (Day 2 — Case Study + soft CTA):
Subject: I saved a {{industry}} {{case_study_result}}

Hi {{first_name}},

{{case_study_result}} from their lead gen by switching from paid ads to a simple outbound email system.

They now book {{outcome_metric}} — and it costs them nothing to run.

I'd love to explore doing the same for {{company}}.

Would you mind if I sent over 2 times we could talk for 15 minutes?

{{sender_name}}

RULES: Specific dollar/result figure. One case study. Low-friction CTA ("Would you mind if..."). 5–6 sentences max.`,
    tags: ['email-2', 'template', 'case-study', 'soft-cta'],
  },
  {
    id: 'template-email3',
    framework: 'hormozi',
    type: 'template',
    text: `EMAIL 3 TEMPLATE (Day 4 — Value content + embedded CTA):
Subject: What's working for {{industry}} right now

Hi {{first_name}},

Three things I've seen work really well for {{industry}} businesses doing outbound right now:

1. Keeping the first email under 5 sentences — reply rates double
2. Referencing a specific result from a similar client (not generic claims)
3. Following up at least 4 times — most replies come on email 3 or 4

Happy to walk you through exactly how we'd set this up for {{company}}.

Still open to a quick 15-minute call if the timing works?

{{sender_name}}

RULES: 3 genuine insights. CTA is secondary, at the end. Value-first.`,
    tags: ['email-3', 'template', 'value-content', 'embedded-cta'],
  },
  {
    id: 'template-email4',
    framework: 'hormozi',
    type: 'template',
    text: `EMAIL 4 TEMPLATE (Day 6 — Direct ask, no apology):
Subject: Still worth a conversation?

{{first_name}},

Sent a few notes over the past week — I get it, things get busy.

But if there's even a chance that adding {{outcome_metric}} without ad spend sounds interesting, I think 15 minutes is worth it.

Here's my calendar: [LINK]

{{sender_name}}

RULES: No apology. Direct. Reference the outcome metric. Short — under 4 sentences. Calendar link required.`,
    tags: ['email-4', 'template', 'direct-ask', 'no-apology'],
  },
  {
    id: 'template-email5',
    framework: 'andy_elliott',
    type: 'template',
    text: `EMAIL 5 TEMPLATE (Day 8 — Break-up):
Subject: Closing your file

{{first_name}},

I'll stop reaching out after this — I don't want to be that person in your inbox.

If outbound email ever becomes interesting for {{company}}, you've got my contact.

Wishing you a strong season.

{{sender_name}}

RULES: Final email. No CTA. Creates finality = urgency without pressure. Leave door open permanently. Never burn the lead.`,
    tags: ['email-5', 'template', 'break-up', 'finality'],
  },

  // ─── INDUSTRY-SPECIFIC EXAMPLES ───────────────────────────────────────────
  {
    id: 'example-roofing-001',
    framework: 'example',
    type: 'example',
    industry: 'roofing',
    text: `ROOFING case study example:
"Recently helped a roofing contractor in Orlando cut $2,400/month from their lead gen costs by switching from paid ads to a simple outbound email system. They now book 3–5 new jobs a month from cold email alone."
Pain signals: no reviews online, no website, seasonal slowdown, competing with national chains.
Outcome metric: "3–5 booked roofing jobs per month without ad spend"`,
    tags: ['roofing', 'case-study', 'example'],
  },
  {
    id: 'example-hvac-001',
    framework: 'example',
    type: 'example',
    industry: 'hvac',
    text: `HVAC case study example:
"Helped an HVAC company in Phoenix book 8 new service contracts in their first 30 days of outbound — no ad spend required."
Pain signals: seasonal demand spikes, relying on Yelp/Angi, technician downtime in off-season.
Outcome metric: "8 new service contracts in 30 days"`,
    tags: ['hvac', 'case-study', 'example'],
  },
  {
    id: 'example-realtor-001',
    framework: 'example',
    type: 'example',
    industry: 'real estate',
    text: `REAL ESTATE case study example:
"Helped a realtor in Austin book 6 seller consultations in 3 weeks using a 5-email sequence to expired listings — zero ad spend."
Pain signals: slow listing pipeline, relying on referrals, market slowdown.
Outcome metric: "6 seller consultations in 3 weeks"`,
    tags: ['real-estate', 'realtor', 'case-study', 'example'],
  },
  {
    id: 'example-landscaping-001',
    framework: 'example',
    type: 'example',
    industry: 'landscaping',
    text: `LANDSCAPING case study example:
"Helped a landscaping company in Denver land 4 commercial contracts worth $18,000 total through a simple cold email campaign targeting property managers."
Pain signals: seasonal revenue gaps, depends on word of mouth, no outbound system.
Outcome metric: "4 commercial contracts, $18,000 in new revenue"`,
    tags: ['landscaping', 'case-study', 'example'],
  },
  {
    id: 'example-agency-001',
    framework: 'example',
    type: 'example',
    industry: 'agency',
    text: `LEAD GEN AGENCY case study example:
"Helped a lead gen agency targeting blue-collar businesses reduce their cost-per-booked-call from $380 to $42 by replacing paid traffic with outbound cold email."
Pain signals: high CAC, clients churning due to expensive leads, relying on FB ads.
Outcome metric: "cost-per-booked-call reduced from $380 to $42"`,
    tags: ['agency', 'lead-gen', 'case-study', 'example'],
  },
];

export function getChunksByTags(tags: string[]): KnowledgeChunk[] {
  return KNOWLEDGE_BASE.filter((chunk) =>
    tags.some((tag) => chunk.tags.includes(tag))
  );
}

export function getChunksByIndustry(industry: string): KnowledgeChunk[] {
  const normalized = industry.toLowerCase();
  return KNOWLEDGE_BASE.filter(
    (chunk) =>
      chunk.industry?.toLowerCase().includes(normalized) ||
      chunk.tags.some((t) => t.includes(normalized))
  );
}

export function getAllChunks(): KnowledgeChunk[] {
  return KNOWLEDGE_BASE;
}
