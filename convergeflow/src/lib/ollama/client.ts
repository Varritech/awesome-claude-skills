import { Ollama } from 'ollama';
import * as Sentry from '@sentry/nextjs';

/**
 * Ollama Cloud client wrapper.
 *
 * Model: GLM-5.1 (default, overridable via OLLAMA_MODEL env)
 * Host:  OLLAMA_API_URL (e.g. https://ollama.com/api)
 * Auth:  Bearer <OLLAMA_API_KEY>
 *
 * All methods capture errors to Sentry then re-throw so callers can decide
 * how to surface failures to the user.
 */

const OLLAMA_HOST = process.env.OLLAMA_API_URL || 'https://ollama.com/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'glm-5.1';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';

const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: OLLAMA_API_KEY
    ? { Authorization: `Bearer ${OLLAMA_API_KEY}` }
    : undefined,
});

export interface EmailPersona {
  /** Industry / vertical the target lead operates in. */
  industry?: string;
  /** Writing style preset (e.g. "concise-direct", "story-driven"). */
  style?: string;
  /** Tone modifiers (e.g. "friendly", "provocative", "empathetic"). */
  tone?: string;
  /** Language code (ISO-639-1). Defaults to English. */
  language?: string;
  /** Custom system prompt that overrides the composed persona. */
  systemPrompt?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(persona: EmailPersona): string {
  if (persona.systemPrompt) return persona.systemPrompt;

  const bits: string[] = [
    'You are a cold-email copywriter for ConvergeFlow.',
    'Write short, human, deliverable messages optimized for booked calls.',
    'Avoid spammy phrases, excessive emojis, and generic openers.',
  ];
  if (persona.industry) bits.push(`The target industry is: ${persona.industry}.`);
  if (persona.style) bits.push(`Style preset: ${persona.style}.`);
  if (persona.tone) bits.push(`Tone modifiers: ${persona.tone}.`);
  if (persona.language) bits.push(`Respond in ${persona.language}.`);
  return bits.join(' ');
}

/**
 * Stream a cold-email draft back to the caller.
 *
 * Yields plain-text chunks as the model produces them so the UI can render
 * a "typewriter" effect. Consumers should accumulate the chunks client-side.
 */
export async function* generateEmail(
  prompt: string,
  persona: EmailPersona = {},
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      stream: true,
      messages: [
        { role: 'system', content: buildSystemPrompt(persona) },
        { role: 'user', content: prompt },
      ],
    });

    for await (const part of response) {
      const chunk = part?.message?.content;
      if (chunk) yield chunk;
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'ollama', method: 'generateEmail' },
    });
    throw error;
  }
}

/**
 * Single-shot chat completion. Useful for Q&A, tool calls, and
 * non-streaming UI flows.
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      stream: false,
      messages,
    });
    return response.message?.content ?? '';
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'ollama', method: 'chat' },
    });
    throw error;
  }
}

/**
 * Produce an embedding vector for the given text. Used for semantic search,
 * lead de-duplication, and ReasoningBank-style pattern retrieval.
 */
export async function embed(text: string): Promise<number[]> {
  try {
    const response = await ollama.embeddings({
      model: OLLAMA_MODEL,
      prompt: text,
    });
    return response.embedding ?? [];
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'ollama', method: 'embed' },
    });
    throw error;
  }
}

export const ollamaClient = {
  generateEmail,
  chat,
  embed,
  model: OLLAMA_MODEL,
  host: OLLAMA_HOST,
};
