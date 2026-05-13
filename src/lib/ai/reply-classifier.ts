/**
 * Reply classifier — uses GLM to classify inbound prospect replies
 * into one of four categories defined in PRD §8.
 */

import { buildClassificationPrompt } from './prompt-builder';

export type ReplyCategory = 'positive' | 'soft_negative' | 'hard_negative' | 'ooo';

export interface ClassificationResult {
  category: ReplyCategory;
  raw: string;
  confidence: 'high' | 'low';
}

const VALID_CATEGORIES = new Set<ReplyCategory>([
  'positive',
  'soft_negative',
  'hard_negative',
  'ooo',
]);

// Heuristic fallback — avoids a GLM call for obvious cases
function heuristicClassify(replyText: string): ReplyCategory | null {
  const lower = replyText.toLowerCase();

  // OOO detection
  if (
    lower.includes('out of office') ||
    lower.includes('on vacation') ||
    lower.includes('will return') ||
    lower.includes('automatic reply') ||
    lower.includes('auto-reply')
  ) {
    return 'ooo';
  }

  // Hard negative
  if (
    lower.includes('remove me') ||
    lower.includes('unsubscribe') ||
    lower.includes('stop emailing') ||
    lower.includes('do not contact') ||
    lower.includes('never contact')
  ) {
    return 'hard_negative';
  }

  return null; // fall through to GLM
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
      options: { temperature: 0 }, // deterministic for classification
    }),
  });

  if (!res.ok) throw new Error(`GLM classify error ${res.status}`);
  const json = (await res.json()) as { message?: { content?: string }; response?: string };
  return (json.message?.content ?? json.response ?? '').trim().toLowerCase();
}

export async function classifyReply(replyText: string): Promise<ClassificationResult> {
  // Fast heuristic first
  const heuristic = heuristicClassify(replyText);
  if (heuristic) {
    return { category: heuristic, raw: replyText, confidence: 'high' };
  }

  const prompt = buildClassificationPrompt(replyText);
  const raw = await callGLM(prompt);

  // Extract first valid category word from response
  const words = raw.split(/\s+/);
  const category = words.find((w) => VALID_CATEGORIES.has(w as ReplyCategory)) as
    | ReplyCategory
    | undefined;

  if (!category) {
    // Default to soft_negative — safer than hard_negative, avoids losing leads
    return { category: 'soft_negative', raw, confidence: 'low' };
  }

  return { category, raw, confidence: 'high' };
}
