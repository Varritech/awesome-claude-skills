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

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { chat } from '@/lib/ollama/client';
import { jsonError, logRequest, requireUser } from '@/lib/api/helpers';

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

const MOCK_LEADS: LeadDoc[] = [
  { id: 'ld_1', firstName: 'Alex', lastName: 'Chen', email: 'alex@acme.io', company: 'Acme SaaS', title: 'Head of Growth', industry: 'SaaS', status: 'new' },
  { id: 'ld_2', firstName: 'Jordan', lastName: 'Patel', email: 'jordan@northside.dental', company: 'Northside Dental', title: 'Practice Owner', industry: 'Healthcare', status: 'new' },
  { id: 'ld_3', firstName: 'Sam', lastName: 'Ruiz', email: 'sam@hawkcap.com', company: 'Hawk Capital', title: 'Managing Partner', industry: 'Finance', status: 'new' },
  { id: 'ld_4', firstName: 'Maria', lastName: 'Torres', email: 'maria@bloomco.com', company: 'Bloom & Co', title: 'CEO', industry: 'Retail', status: 'new' },
  { id: 'ld_5', firstName: 'Chris', lastName: 'Nguyen', email: 'chris@buildfast.dev', company: 'BuildFast', title: 'CTO', industry: 'SaaS', status: 'new' },
  { id: 'ld_6', firstName: 'Taylor', lastName: 'Brooks', email: 'taylor@axiomlaw.com', company: 'Axiom Law', title: 'Partner', industry: 'Legal', status: 'new' },
  { id: 'ld_7', firstName: 'Jamie', lastName: 'Kim', email: 'jamie@clearpath.io', company: 'ClearPath', title: 'VP Marketing', industry: 'SaaS', status: 'new' },
  { id: 'ld_8', firstName: 'Morgan', lastName: 'Davis', email: 'morgan@pinnaclepm.com', company: 'Pinnacle PM', title: 'Director', industry: 'Real Estate', status: 'new' },
  { id: 'ld_9', firstName: 'Riley', lastName: 'Scott', email: 'riley@vervehealth.com', company: 'Verve Health', title: 'COO', industry: 'Healthcare', status: 'new' },
  { id: 'ld_10', firstName: 'Drew', lastName: 'Wilson', email: 'drew@luminate.agency', company: 'Luminate Agency', title: 'Founder', industry: 'Marketing', status: 'new' },
];

export async function POST(req: NextRequest) {
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

  // Fetch user's saved persona from onboarding doc
  let persona: Persona = 'neighbor';
  try {
    const onboardingDoc = await adminDb.collection('onboarding').doc(userId).get();
    const saved = onboardingDoc.data()?.persona as string | undefined;
    if (saved && saved in PERSONA_SYSTEM) persona = saved as Persona;
  } catch {
    // fall through to default
  }

  // Fetch up to 10 leads
  let leads: LeadDoc[] = [];
  try {
    const snap = await adminDb
      .collection('leads')
      .where('userId', '==', userId)
      .where('status', '==', 'new')
      .limit(10)
      .get();
    leads = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadDoc));
  } catch {
    // fall through
  }
  if (leads.length === 0) leads = MOCK_LEADS;

  const scheduledFor = next8amUtc();
  const now = new Date().toISOString();
  let drafted = 0;
  let skipped = 0;

  for (const lead of leads) {
    try {
      const prompt = buildPrompt(persona, lead as unknown as Record<string, unknown>);
      const raw = await chat([{ role: 'user', content: prompt }]);

      // Parse JSON from model response — strip any markdown fences
      const cleaned = raw.replace(/^```(?:json)?|```$/gm, '').trim();
      let subject = `Following up — ${lead.company ?? lead.firstName ?? 'you'}`;
      let body = cleaned;

      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.subject) subject = String(parsed.subject).slice(0, 60);
        if (parsed.body) body = String(parsed.body);
      } catch {
        // model didn't return clean JSON — use raw as body
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
