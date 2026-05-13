/**
 * Sequence generator — produces a complete 5-email Straight Line sequence
 * for a given prospect using RAG + GLM.
 *
 * Also generates A/B variants of Emails 1 & 2 for split testing.
 */

import { retrieveForEmail } from '@/lib/rag/retriever';
import { buildTokens, injectTokens, type ProspectContext, type CampaignContext } from './personalization';
import { buildEmailPrompt } from './prompt-builder';

const SEND_DAYS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 8 };

export interface GeneratedEmail {
  emailNumber: 1 | 2 | 3 | 4 | 5;
  dayOffset: number;      // days after campaign start to send
  subject: string;
  body: string;
  variant: 'A' | 'B';
  plainText: true;        // enforced — always plain text
}

export interface GeneratedSequence {
  emails: GeneratedEmail[];  // 7 total: A variants for all 5 + B variants for emails 1 & 2
  prospect: ProspectContext;
  campaign: CampaignContext;
  generatedAt: string;
}

async function callGLM(prompt: string): Promise<string> {
  const apiUrl = process.env.OLLAMA_API_URL ?? 'https://ollama.com/api';
  const model = process.env.OLLAMA_MODEL ?? 'glm-5.1';
  const apiKey = process.env.OLLAMA_API_KEY;

  const res = await fetch(`${apiUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GLM generation error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { message?: { content?: string }; response?: string };
  return json.message?.content ?? json.response ?? '';
}

function parseEmailResponse(raw: string): { subject: string; body: string } {
  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)$/im);
  const bodyMatch = raw.match(/^BODY:\s*\n([\s\S]+)/im);

  const subject = subjectMatch?.[1]?.trim() ?? 'Following up';
  const body = bodyMatch?.[1]?.trim() ?? raw.trim();

  return { subject, body };
}

async function generateEmail(
  emailNumber: 1 | 2 | 3 | 4 | 5,
  prospect: ProspectContext,
  campaign: CampaignContext,
  variant: 'A' | 'B' = 'A'
): Promise<GeneratedEmail> {
  const tokens = buildTokens(prospect, campaign);
  const ragChunks = await retrieveForEmail(emailNumber, {
    industry: prospect.industry ?? campaign.niche,
  });

  const prompt = buildEmailPrompt({ emailNumber, ragChunks, tokens, prospect, campaign, variant });
  const raw = await callGLM(prompt);
  const { subject, body } = parseEmailResponse(raw);

  // Inject remaining tokens into subject line
  const personalizedSubject = injectTokens(subject, tokens);

  return {
    emailNumber,
    dayOffset: SEND_DAYS[emailNumber]!,
    subject: personalizedSubject,
    body,
    variant,
    plainText: true,
  };
}

/**
 * Generate a full 5-email sequence with A/B variants for Emails 1 & 2.
 * Total: 7 email objects (5 A-variants + 1 extra B for email 1, 1 extra B for email 2).
 */
export async function generateSequence(
  prospect: ProspectContext,
  campaign: CampaignContext
): Promise<GeneratedSequence> {
  // Generate all in parallel where possible (emails are independent of each other)
  const [e1a, e1b, e2a, e2b, e3, e4, e5] = await Promise.all([
    generateEmail(1, prospect, campaign, 'A'),
    generateEmail(1, prospect, campaign, 'B'),
    generateEmail(2, prospect, campaign, 'A'),
    generateEmail(2, prospect, campaign, 'B'),
    generateEmail(3, prospect, campaign, 'A'),
    generateEmail(4, prospect, campaign, 'A'),
    generateEmail(5, prospect, campaign, 'A'),
  ]);

  return {
    emails: [e1a, e1b, e2a, e2b, e3, e4, e5],
    prospect,
    campaign,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a single email for a specific position in an existing campaign.
 * Used when re-generating after feedback or when the A/B winner is selected.
 */
export async function regenerateEmail(
  emailNumber: 1 | 2 | 3 | 4 | 5,
  prospect: ProspectContext,
  campaign: CampaignContext,
  variant: 'A' | 'B' = 'A'
): Promise<GeneratedEmail> {
  return generateEmail(emailNumber, prospect, campaign, variant);
}
