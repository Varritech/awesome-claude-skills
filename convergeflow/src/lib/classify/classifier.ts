/**
 * AI-based reply intent classifier.
 *
 * Uses the existing Ollama client to classify reply text into one of five
 * categories. Falls back to keyword-based classification if Ollama is
 * unavailable or returns an unexpected value.
 */

import { ollamaClient } from '@/lib/ollama/client';
import * as Sentry from '@sentry/nextjs';
import type { ReplyCategory } from '@/lib/schemas/campaign';

export interface ClassifyContext {
  /** The original outbound email body (for context) */
  originalEmail?: string;
  /** The lead's name (for context) */
  leadName?: string;
}

const CLASSIFY_PROMPT = `You are an email reply classifier. Categorize this reply into exactly one category:

- interested: prospect shows genuine interest, asks for more info, wants to proceed, says "tell me more" or "let's talk"
- booked: prospect explicitly books a call, confirms a meeting time, says "yes" to a calendar invite, or schedules
- question: prospect asks a clarifying question but hasn't committed either way
- not_interested: prospect declines, says no, asks to be removed, says "not a fit" or "stop emailing"
- auto_reply: out-of-office, vacation responder, or automated message

Reply with ONLY the category name, nothing else. No punctuation, no explanation.`;

/**
 * Classify a reply using Ollama AI. Returns the category and confidence.
 * Falls back to keyword matching if Ollama fails.
 */
export async function classifyReply(
  text: string,
  context: ClassifyContext = {},
): Promise<{ category: ReplyCategory; confidence: 'high' | 'medium' | 'low' }> {
  try {
    const userMessage = buildUserMessage(text, context);
    const response = await ollamaClient.chat([
      { role: 'system', content: CLASSIFY_PROMPT },
      { role: 'user', content: userMessage },
    ]);

    const parsed = parseCategory(response);
    if (parsed) {
      return { category: parsed, confidence: 'high' };
    }

    // AI returned something unexpected — fall back to keywords
    Sentry.captureMessage('Ollama returned unexpected classification', {
      level: 'warning',
      extra: { response, replyText: text.slice(0, 200) },
    });
    return classifyByKeywords(text);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'classify', method: 'classifyReply' },
    });
    return classifyByKeywords(text);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUserMessage(text: string, context: ClassifyContext): string {
  const parts: string[] = [];
  if (context.leadName) {
    parts.push(`Lead name: ${context.leadName}`);
  }
  if (context.originalEmail) {
    parts.push(`Original email: ${context.originalEmail.slice(0, 500)}`);
  }
  parts.push(`Reply to classify:\n${text.slice(0, 2000)}`);
  return parts.join('\n\n');
}

function parseCategory(raw: string): ReplyCategory | null {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z_]/g, '');
  const valid: ReplyCategory[] = [
    'interested',
    'booked',
    'question',
    'not_interested',
    'auto_reply',
  ];
  for (const cat of valid) {
    if (cleaned === cat) return cat;
  }
  // Try partial match — check for "not_interested" before "interested"
  // to avoid false matches on "not" + "interest" appearing separately
  if (/\bnot\b.*\binterest/i.test(cleaned) || cleaned.includes('not_interested') || cleaned.includes('notinterested')) return 'not_interested';
  if (cleaned.includes('book')) return 'booked';
  if (cleaned.includes('interest')) return 'interested';
  if (cleaned.includes('question')) return 'question';
  if (cleaned.includes('auto') || cleaned.includes('office')) return 'auto_reply';
  return null;
}

// ─── Keyword fallback ────────────────────────────────────────────────────────

const KEYWORD_MAP: Array<{ category: ReplyCategory; keywords: RegExp[] }> = [
  {
    category: 'booked',
    keywords: [
      /book(ed|ing)?\s*(a\s*)?(call|meeting|time|demo)/i,
      /(confirm|confirmed|scheduled|set\s*up)\s*(a\s*)?(call|meeting|time)/i,
      /(see|talk|speak)\s*(you|then)\s*(on|at|tomorrow|next|monday|tuesday|wednesday|thursday|friday)/i,
      /calendar\s*(invite|link|event)/i,
      /(yes|sure|absolutely|definitely).*(call|meeting|chat|talk)/i,
      /(let'?s|happy\s*to)\s*(do|schedule|set\s*up|book|find\s*a?\s*time)/i,
    ],
  },
  {
    category: 'interested',
    keywords: [
      /(interested|tell\s*me\s*more|learn\s*more|sounds?\s*(good|interesting|great|awesome))/i,
      /(how\s*(does|much|many|long|can|do)|what\s*(is|are|does|would))/i,
      /(send|share|forward)\s*(me|over|the|more|some)\s*(info|details|pricing|information)/i,
      /(would\s*(love|like|be)\s*to|i'?d\s*(love|like|be)\s*(to|interested))/i,
      /(can\s*(we|you|i)\s*(chat|talk|connect|hop\s*on|jump\s*on))/i,
      /(yes|sure|absolutely|definitely)\s*(,|\.|!|\s|$).*(call|meeting|chat|talk|schedule|connect|learn|hear)/i,
      /(go\s*ahead|sounds?\s*(good|great|awesome|interesting|promising))/i,
    ],
  },
  {
    category: 'question',
    keywords: [
      /^(what|how|when|where|who|why|can|could|would|do|does|is|are|will)\b/i,
      /\?$/m,
      /(question|wondering|curious|not\s*sure|confused|clarify)/i,
      /(does\s*(it|this|that)|how\s*(does|much|many|long))/i,
    ],
  },
  {
    category: 'not_interested',
    keywords: [
      /(not\s*interested|no\s*thanks|no\s*thank\s*you|not\s*a\s*(fit|good\s*fit|match))/i,
      /(unsubscribe|remove\s*(me|from|my)|stop\s*(emailing|sending|contacting))/i,
      /(don'?t\s*(contact|email|reach\s*out|send)|do\s*not\s*(contact|email))/i,
      /(leave\s*me\s*alone|spam|waste\s*of\s*time)/i,
      /(wrong\s*(person|email|address|number)|not\s*(the\s*right|relevant))/i,
    ],
  },
  {
    category: 'auto_reply',
    keywords: [
      /(out\s*of\s*(the\s*)?office|vacation|holiday|leave|away\s*from)/i,
      /(automated|automatic)\s*(reply|response|message)/i,
      /(will\s*(be\s*back|return)|limited\s*access\s*to\s*email)/i,
    ],
  },
];

function classifyByKeywords(
  text: string,
): { category: ReplyCategory; confidence: 'medium' | 'low' } {
  const scores = new Map<ReplyCategory, number>();

  for (const { category, keywords } of KEYWORD_MAP) {
    let score = 0;
    for (const pattern of keywords) {
      if (pattern.test(text)) score++;
    }
    if (score > 0) scores.set(category, score);
  }

  if (scores.size === 0) {
    // Default to question if nothing matches — safest neutral category
    return { category: 'question', confidence: 'low' };
  }

  // Find the category with the highest score
  let best: ReplyCategory = 'question';
  let bestScore = 0;
  const scoreEntries = Array.from(scores.entries());
  for (const [cat, score] of scoreEntries) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  // Confidence based on score margin
  const confidence = bestScore >= 3 ? 'medium' : 'low';
  return { category: best, confidence };
}
