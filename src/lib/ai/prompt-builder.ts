/**
 * Prompt builder — assembles the final LLM prompt for email generation.
 * Combines: framework rules (RAG), email template, prospect context, campaign context.
 */

import type { KnowledgeChunk } from '@/lib/rag/knowledge-base';
import type { RetrievalResult } from '@/lib/rag/retriever';
import type { PersonalizationTokens, CampaignContext, ProspectContext } from './personalization';

/** Maps built-in persona IDs to their exclusive framework source. */
export const PERSONA_FRAMEWORK_MAP: Record<string, KnowledgeChunk['framework']> = {
  closer:   'andy_elliott',
  neighbor: 'belfort',
  expert:   'hormozi',
  helper:   'sam_ovens',
};

const PERSONA_TONE_INSTRUCTIONS: Record<string, string> = {
  closer:
    'Andy Elliott style: 3-part structure — acknowledge their work, specific case study result, one low-friction CTA. Max 6 sentences. Confidence without arrogance. Subject lines spark curiosity.',
  neighbor:
    'Jordan Belfort Straight Line style: rapport-first tone. Email 1 = zero ask, build conscious + unconscious trust. Short, confident, never desperate. Warm but not sycophantic.',
  expert:
    'Hormozi style: value-before-ask. Deposit goodwill before opening the valve. Broad sends, ROI logic, repeat the ask without apology. Embed CTAs inside value content.',
  helper:
    'Sam Ovens Consulting Accelerator style: Hunt → Advance → Farm → Close funnel. Lead with a generous offer — give a small win for free. 15-minute call as the only conversion goal. Never pressure.',
};

export interface EmailPromptInput {
  emailNumber: 1 | 2 | 3 | 4 | 5;
  ragChunks: RetrievalResult[];
  tokens: PersonalizationTokens;
  prospect: ProspectContext;
  campaign: CampaignContext;
  variant?: 'A' | 'B'; // for A/B subject line testing
  personaId?: string;  // maps to a framework via PERSONA_FRAMEWORK_MAP
}

const EMAIL_OBJECTIVES: Record<number, string> = {
  1: 'RAPPORT ONLY. No ask. Build trust. Under 4 sentences. Name + city only. Confident, not needy. Zero pitch.',
  2: 'CASE STUDY + SOFT CTA. Compliment or acknowledge their business, then a specific case study ($X result), then a low-friction 15-minute ask. 5–6 sentences max.',
  3: 'VALUE CONTENT + EMBEDDED CTA. Provide 3 genuine insights the prospect can use even if they never reply. CTA is secondary, at the end. Value-first. 8–10 sentences max.',
  4: 'DIRECT ASK. No apology for following up. Reference the outcome metric. Short — 3–4 sentences. Include calendar link placeholder [LINK].',
  5: 'BREAK-UP EMAIL. Final contact. No CTA. Creates finality = urgency without pressure. Leave the door permanently open. Never burn the lead. 4 sentences max.',
};

const SUBJECT_LINE_GUIDES: Record<number, { A: string; B: string }> = {
  1: {
    A: '{{city}} {{industry}} crews',
    B: 'Quick note, {{first_name}}',
  },
  2: {
    A: 'I saved a {{industry}} {{case_study_result}}',
    B: 'Something that worked for a {{industry}} business',
  },
  3: {
    A: "What's working for {{industry}} right now",
    B: '3 things top {{industry}} businesses do differently',
  },
  4: {
    A: 'Still worth a conversation?',
    B: 'One last thought, {{first_name}}',
  },
  5: {
    A: 'Closing your file',
    B: 'Last one from me',
  },
};

export function buildEmailPrompt(input: EmailPromptInput): string {
  const { emailNumber, ragChunks, tokens, campaign, variant = 'A', personaId } = input;

  const frameworkRules = ragChunks
    .filter((r) => r.chunk.type === 'rule')
    .slice(0, 4)
    .map((r) => `- ${r.chunk.text}`)
    .join('\n');

  const exampleEmails = ragChunks
    .filter((r) => r.chunk.type === 'template' || r.chunk.type === 'example')
    .slice(0, 2)
    .map((r) => r.chunk.text)
    .join('\n\n---\n\n');

  const subjectTemplate = SUBJECT_LINE_GUIDES[emailNumber]?.[variant] ?? '';

  const personaToneSection =
    personaId && PERSONA_TONE_INSTRUCTIONS[personaId]
      ? `\nPERSONA TONE (follow exclusively — overrides generic tone guidance):\n${PERSONA_TONE_INSTRUCTIONS[personaId]}\n`
      : '';

  return `You are an expert cold email writer for ConvergeFlow, an outbound email platform.
Generate Email ${emailNumber} of 5 in a Straight Line cold sequence.

OBJECTIVE FOR THIS EMAIL:
${EMAIL_OBJECTIVES[emailNumber]}

PROSPECT CONTEXT:
- Name: ${tokens.first_name}
- Company: ${tokens.company}
- Industry: ${tokens.industry}
- Location: ${tokens.city}
- Pain signal: ${tokens.pain_signal}

CAMPAIGN CONTEXT:
- Sender: ${tokens.sender_name}
- Business: ${campaign.businessName}
- Offer: ${campaign.offer}
- Case study result: ${tokens.case_study_result}
- Outcome metric: ${tokens.outcome_metric}

${personaToneSection}FRAMEWORK RULES (follow strictly):
${frameworkRules}

REFERENCE EXAMPLES:
${exampleEmails}

SUBJECT LINE TEMPLATE (adapt, do not copy verbatim):
${subjectTemplate}

OUTPUT FORMAT — respond with exactly:
SUBJECT: <subject line>
BODY:
<email body — plain text only, no HTML, no markdown, no formatting>

CRITICAL RULES:
- Plain text ONLY. No bullet points, no bold, no links except [LINK] placeholder for calendar.
- Do NOT mention ConvergeFlow by name in the email body.
- Write in first person as ${tokens.sender_name}.
- Keep it human. Sound like a real person, not a marketing email.
- Match the tone objective exactly for Email ${emailNumber}.
- Never use the word "just" as a filler.
- Never start with "I hope this email finds you well" or any variant.`;
}

export function buildClassificationPrompt(replyText: string): string {
  return `Classify the following cold email reply into exactly one category.

CATEGORIES:
- positive: The prospect shows genuine interest, asks for more info, wants to schedule a call, or says "yes" in any form.
- soft_negative: The prospect declines but leaves the door open. "Not right now", "maybe later", "too busy", "reach out in Q3".
- hard_negative: The prospect asks to be removed, says never contact again, is angry, or explicitly says no with finality.
- ooo: Auto-reply or out-of-office message detected.

REPLY TO CLASSIFY:
"""
${replyText}
"""

Respond with exactly one word: positive, soft_negative, hard_negative, or ooo.
No explanation. No punctuation. Just the category.`;
}
