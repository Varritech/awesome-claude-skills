/**
 * /api/personas - list built-in + custom personas, create custom.
 *
 * Built-ins: The Closer, The Neighbor, The Expert, The Helper.
 * TODO: Wire custom-persona storage once the "custom GLMs" feature ships.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { createPersonaSchema } from '@/lib/schemas';
import type { KnowledgeChunk } from '@/lib/rag/knowledge-base';

export const dynamic = 'force-dynamic';

interface PersonaRecord {
  id: string;
  builtIn: boolean;
  name: string;
  description: string;
  systemPrompt: string;
  tone: 'direct' | 'warm' | 'expert' | 'friendly' | 'irreverent';
  framework?: KnowledgeChunk['framework']; // present on built-ins; absent on custom
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const BUILT_INS: PersonaRecord[] = [
  {
    id: 'closer',
    builtIn: true,
    name: 'The Closer',
    description:
      'Direct, confident, outcome-focused. Gets to the point, leans on specific results, single CTA.',
    systemPrompt:
      'You are The Closer. Write direct, confident cold emails that get to the point fast, lean on a specific outcome, and end with a single clear CTA.',
    tone: 'direct',
    framework: 'andy_elliott',
  },
  {
    id: 'neighbor',
    builtIn: true,
    name: 'The Neighbor',
    description: 'Warm, conversational, friendly. Feels like a note from someone nearby.',
    systemPrompt:
      'You are The Neighbor. Write warm, conversational cold emails that feel like a friendly note from someone down the street.',
    tone: 'warm',
    framework: 'belfort',
  },
  {
    id: 'expert',
    builtIn: true,
    name: 'The Expert',
    description: 'Credible, insight-led. Demonstrates deep subject-matter expertise without jargon.',
    systemPrompt:
      'You are The Expert. Write credible, insight-led cold emails that demonstrate deep subject-matter expertise without jargon.',
    tone: 'expert',
    framework: 'hormozi',
  },
  {
    id: 'helper',
    builtIn: true,
    name: 'The Helper',
    description: 'Generous, no-ask. Offers a small piece of value first and asks for nothing upfront.',
    systemPrompt:
      'You are The Helper. Write short, generous cold emails that offer a small piece of value first and ask for nothing upfront.',
    tone: 'friendly',
    framework: 'sam_ovens',
  },
];

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('personas.GET', userId);

  let custom: PersonaRecord[] = [];
  try {
    const snap = await adminDb
      .collection('personas')
      .where('userId', '==', userId)
      .get();
    custom = snap.docs.map((d) => d.data() as PersonaRecord);
  } catch (err) {
    console.warn('[api:personas.GET] no custom personas (placeholder mode)', err);
  }

  return NextResponse.json({
    data: { builtIns: BUILT_INS, custom },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createPersonaSchema);
  if (parsed.response) return parsed.response;

  const now = new Date().toISOString();
  const id = `psn_${Math.random().toString(36).slice(2, 12)}`;
  const record: PersonaRecord = {
    id,
    builtIn: false,
    name: parsed.data.name,
    description: parsed.data.description ?? '',
    systemPrompt: parsed.data.systemPrompt,
    tone: parsed.data.tone,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  logRequest('personas.POST', userId, { id, name: record.name });

  try {
    await adminDb.collection('personas').doc(id).set(record);
  } catch (err) {
    console.warn('[api:personas.POST] placeholder mode', err);
  }

  return NextResponse.json({ data: record }, { status: 201 });
}
