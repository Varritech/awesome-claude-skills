/**
 * /api/emails/[id]/generate - stream an AI-generated email body.
 *
 * Request body:
 *   {
 *     persona:  'closer' | 'neighbor' | 'expert' | 'helper',
 *     leadData: { firstName?, lastName?, company?, title?, industry?, location?, email?, ... },
 *     prompt?:  string
 *   }
 *
 * Streams GLM-5.1 chunks back via an SSE-style text stream
 * (`data: { "response": "...", "done": false }\n\n` per chunk) so the UI
 * can render a typewriter effect.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateEmail } from '@/lib/ollama/client';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { generateEmailSchema, type Persona } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx {
  params: { id: string };
}

const PRESET_PROMPTS: Record<Persona, string> = {
  closer:
    'Write a direct, confident cold email that leans on a specific outcome and ends with one clear CTA.',
  neighbor:
    'Write a warm, conversational cold email that feels like a friendly note from someone nearby.',
  expert:
    'Write a credible, insight-led cold email that demonstrates deep subject-matter expertise without jargon.',
  helper:
    'Write a short, generous cold email that offers a small piece of value first and asks for nothing upfront.',
};

const PRESET_TONES: Record<Persona, string> = {
  closer: 'direct, confident, outcome-focused',
  neighbor: 'warm, conversational, friendly',
  expert: 'credible, insightful, concise',
  helper: 'generous, helpful, no-ask',
};

function buildUserPrompt(
  preset: Persona,
  leadData: Record<string, unknown>,
  extra: string | undefined,
): string {
  const firstName = (leadData.firstName as string) ?? 'the prospect';
  const company = (leadData.company as string) ?? 'their company';
  const industry = (leadData.industry as string) ?? 'their industry';
  const title = (leadData.title as string) ?? 'their role';

  const header = PRESET_PROMPTS[preset];
  const context = [
    `Prospect: ${firstName} (${title}) at ${company}.`,
    `Industry: ${industry}.`,
  ].join(' ');
  const instruction = extra ? `Additional instructions: ${extra}` : '';
  return [header, context, instruction].filter(Boolean).join('\n');
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  const parsed = await parseAndValidate(req, generateEmailSchema);
  if (parsed.response) return parsed.response;
  const { persona, leadData, prompt } = parsed.data;

  logRequest('emails.[id].generate.POST', userId, { id, persona });

  const userPrompt = buildUserPrompt(persona, leadData, prompt);
  const ollamaPersona = {
    industry: (leadData.industry as string) ?? undefined,
    style: persona,
    tone: PRESET_TONES[persona],
  };

  try {
    const iterator = generateEmail(userPrompt, ollamaPersona);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of iterator) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ response: chunk, done: false })}\n\n`,
              ),
            );
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ response: '', done: true })}\n\n`,
            ),
          );
          controller.close();
        } catch (err) {
          console.error('[api:emails.[id].generate] stream error', err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: 'generation_failed',
                done: true,
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[api:emails.[id].generate] error', err);
    return jsonError('Failed to start generation', 502);
  }
}
