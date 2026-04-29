/**
 * /api/personas/generate - turn a plain-English style description into a
 * cold-email system prompt the AI will use when writing emails.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Ollama } from 'ollama';
import { jsonError, logRequest, parseAndValidate, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().min(10).max(1000),
});

const OLLAMA_HOST = process.env.OLLAMA_API_URL || 'https://ollama.com/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'glm-5.1';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';

const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : undefined,
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, schema);
  if (parsed.response) return parsed.response;
  const { name, description } = parsed.data;

  logRequest('personas.generate.POST', userId, { name });

  const systemInstruction = `You are an expert cold-email copywriting coach.
When given a description of how someone wants to sound in their cold emails,
you write a concise system prompt (2-4 sentences) that an AI email writer will use.
The system prompt should capture the voice, tone, style, and any specific rules.
Output ONLY the system prompt — no explanation, no preamble, no quotes.`;

  const userMessage = `Name: ${name ?? 'Custom Style'}
Description: ${description}

Write the system prompt for this cold-email writing style.`;

  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userMessage },
      ],
      options: { temperature: 0.7, num_predict: 300 },
    });

    const systemPrompt = response.message?.content?.trim() ?? '';
    if (!systemPrompt) {
      return jsonError('Empty response from AI', 502);
    }

    return NextResponse.json({ data: { systemPrompt } });
  } catch (err) {
    console.error('[api:personas.generate] error', err);
    // Graceful fallback so the UI can still save something useful
    const fallback = `You are a cold email writer named "${name ?? 'Custom Style'}". ${description.trim()} Always keep emails concise, personal, and end with one clear call to action.`;
    return NextResponse.json({ data: { systemPrompt: fallback } });
  }
}
