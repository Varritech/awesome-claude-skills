/**
 * AI-powered reply classifier using Ollama.
 *
 * Falls back to keyword-based classification if Ollama is unavailable.
 */

import { classifyByKeywords } from "./categories";
import type { ReplyCategory } from "./categories";

const VALID_CATEGORIES = new Set<string>([
  "interested",
  "not_interested",
  "do_not_contact",
  "auto_reply",
  "out_of_office",
  "referral",
  "question",
  "booked",
]);

export interface OllamaClientForClassifier {
  chat(messages: { role: string; content: string }[]): Promise<string>;
}

/**
 * Classify an email reply body using the Ollama LLM.
 * Falls back to keyword classification if AI is unavailable or returns an unexpected value.
 */
export async function classifyReplyWithAI(
  body: string,
  ollamaClient: OllamaClientForClassifier
): Promise<ReplyCategory> {
  try {
    const result = await ollamaClient.chat([
      {
        role: "system",
        content:
          "Classify this email reply into exactly one category: interested/not_interested/do_not_contact/auto_reply/out_of_office/referral/question/booked. Respond with only the category name.",
      },
      {
        role: "user",
        content: body,
      },
    ]);

    const trimmed = result
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "");
    if (VALID_CATEGORIES.has(trimmed)) {
      return trimmed as ReplyCategory;
    }

    // AI returned something unexpected — fall back
    return classifyByKeywords(body);
  } catch {
    // Ollama unavailable — fall back to keyword classifier
    return classifyByKeywords(body);
  }
}
