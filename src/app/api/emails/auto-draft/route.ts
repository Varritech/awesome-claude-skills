/**
 * /api/emails/auto-draft
 *
 * POST — idempotent. Fetches up to 10 leads for the user, drafts one email
 * per lead using the persona saved during onboarding, and writes each as an
 * email record with status "queued" and scheduledFor set to the next 8 AM UTC.
 *
 * Returns { drafted: number, skipped: number } — safe to call on every
 * dashboard mount; exits early when queued/sent emails already exist.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { chat } from '@/lib/ollama/client';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Persona = 'closer' | 'neighbor' | 'expert' | 'helper';

const PERSONA_SYSTEM: Record<Persona, string> = {
  closer:
    'You write direct, confident cold emails. Lead with a specific outcome. End with one clear CTA. No fluff.',
  neighbor:
    'You write warm, conversational cold emails. Sound like a friendly peer, not a salesperson.',
  expert:
    'You write insight-led cold emails that show deep expertise without jargon. Concise and credible.',
  helper:
    'You write generous cold emails that offer a small piece of value upfront and ask for nothing immediately.',
};

function next8amUtc(): string {
  const now = new Date();
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0, 0),
  );
  if (candidate <= now) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}

function buildPrompt(persona: Persona, lead: Record<string, unknown>): string {
  const firstName = (lead.firstName as string) ?? 'there';
  const company = (lead.company as string) ?? 'your company';
  const title = (lead.title as string) ?? '';
  const industry = (lead.industry as string) ?? '';

  return [
    PERSONA_SYSTEM[persona],
    '',
    `Write a cold outreach email to ${firstName}${title ? `, ${title}` : ''}${company ? ` at ${company}` : ''}.`,
    industry ? `Industry: ${industry}.` : '',
    '',
    'Return ONLY valid JSON with two keys: "subject" (string, ≤60 chars) and "body" (string, plain text, 3-5 short paragraphs, use {{firstName}} as the greeting placeholder).',
    'No markdown. No explanation. Just the JSON object.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

interface LeadDoc {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  industry?: string;
  email?: string;
  status: string;
}


export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('emails.auto-draft.POST', userId, {});

  // Idempotency: skip if user already has queued or sent emails
  try {
    const existingSnap = await adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .where('status', 'in', ['queued', 'sent', 'opened', 'replied'])
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return NextResponse.json({ drafted: 0, skipped: 0, alreadyDrafted: true });
    }
  } catch {
    // Firestore unavailable — continue with mock path
  }

  // Fetch user's saved persona from users doc (set during onboarding as preferredStyle)
  let persona: Persona = 'neighbor';
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const saved = userDoc.data()?.preferredStyle as string | undefined;
    if (saved && saved in PERSONA_SYSTEM) persona = saved as Persona;
  } catch {
    // fall through to default
  }

  // Fetch up to 10 leads
  const leadsSnap = await adminDb
    .collection('leads')
    .where('userId', '==', userId)
    .where('status', '==', 'new')
    .limit(10)
    .get();
  const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadDoc));
  if (leads.length === 0) {
    return NextResponse.json({ drafted: 0, skipped: 0, alreadyDrafted: false });
  }

  const scheduledFor = next8amUtc();
  const now = new Date().toISOString();
  let drafted = 0;
  let skipped = 0;

  for (const lead of leads) {
    try {
      const firstName = lead.firstName ?? 'there';
      const company = lead.company ?? 'your company';
      let subject = `Quick question — ${company}`;
      let body = `Hi {{firstName}},\n\nI came across ${company} and wanted to reach out.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,`;

      try {
        const prompt = buildPrompt(persona, lead as unknown as Record<string, unknown>);
        const raw = await chat([{ role: 'user', content: prompt }]);
        const cleaned = raw.replace(/^```(?:json)?|```$/gm, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.subject) subject = String(parsed.subject).slice(0, 60);
        if (parsed.body) body = String(parsed.body);
      } catch {
        // Ollama unavailable or parse failed — use template fallback above
        console.warn('[auto-draft] AI generation failed for lead', lead.id, '— using template');
      }

      const id = `em_${Math.random().toString(36).slice(2, 12)}`;
      const record = {
        id,
        userId,
        leadId: lead.id,
        campaignId: null,
        subject,
        body,
        persona,
        status: 'queued',
        scheduledFor,
        createdAt: now,
        updatedAt: now,
        sentAt: null,
        deletedAt: null,
      };

      try {
        await adminDb.collection('emails').doc(id).set(record);
      } catch {
        // Firestore write failed — record still counted so UI shows something
      }

      drafted++;
    } catch (err) {
      console.warn('[auto-draft] skipped lead', lead.id, err);
      skipped++;
    }
  }

  return NextResponse.json({ drafted, skipped, alreadyDrafted: false });
}
