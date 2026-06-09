/**
 * Drafts the next batch of outreach emails for a single user.
 *
 * Same logic the /api/emails/auto-draft route uses when the dashboard
 * fires it on mount, extracted so both that route AND the
 * /api/cron/auto-draft-daily cron job can call it.
 *
 * Behaviour:
 *  - reads the user's saved persona (preferredStyle on the users doc)
 *  - resolves an active inbox (warming or active)
 *  - pulls up to QUEUE_BATCH_SIZE new leads via fetchUserLeads
 *  - per-window idempotent: returns { alreadyDrafted: true } if drafts
 *    for this 8 AM UTC window already exist for the user
 *  - tries Ollama for AI generation; falls back to a template per lead
 *  - writes each as a queued email scheduled for the next 8 AM UTC
 */

import type { Firestore } from 'firebase-admin/firestore';
import { chat } from '@/lib/ollama/client';
import { next8amUtc } from '@/lib/emails/schedule';
import { fetchUserLeads, type FetchedLead } from '@/lib/leads/fetch';

export const QUEUE_BATCH_SIZE = 20;

export type Persona = 'closer' | 'neighbor' | 'expert' | 'helper';

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

export interface DraftResult {
  drafted: number;
  skipped: number;
  alreadyDrafted: boolean;
  noInbox?: boolean;
  noLeads?: boolean;
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
    .filter((l) => l !== '')
    .join('\n');
}

export async function draftEmailsForUser(
  db: Firestore,
  userId: string,
): Promise<DraftResult> {
  const scheduledFor = next8amUtc();

  const existingSnap = await db
    .collection('emails')
    .where('userId', '==', userId)
    .where('status', '==', 'queued')
    .where('scheduledFor', '==', scheduledFor)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    return { drafted: 0, skipped: 0, alreadyDrafted: true };
  }

  let persona: Persona = 'neighbor';
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const saved = userDoc.data()?.preferredStyle as string | undefined;
    if (saved && saved in PERSONA_SYSTEM) persona = saved as Persona;
  } catch {
    // fall through to default
  }

  let inboxId: string | null = null;
  try {
    const inboxSnap = await db
      .collection('inboxes')
      .where('userId', '==', userId)
      .where('status', 'in', ['warming', 'active'])
      .limit(1)
      .get();
    if (!inboxSnap.empty) inboxId = inboxSnap.docs[0].id;
  } catch {
    // No inbox — cron sender will skip until one is connected
  }

  if (!inboxId) {
    return { drafted: 0, skipped: 0, alreadyDrafted: false, noInbox: true };
  }

  let leads: FetchedLead[] = [];
  try {
    leads = await fetchUserLeads(userId, {
      limit: QUEUE_BATCH_SIZE,
      status: 'new',
    });
  } catch (err) {
    console.warn('[draft-for-user] lead fetch failed', err);
  }
  if (leads.length === 0) {
    return { drafted: 0, skipped: 0, alreadyDrafted: false, noLeads: true };
  }

  const now = new Date().toISOString();
  let drafted = 0;
  let skipped = 0;

  for (const lead of leads) {
    try {
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
        console.warn(
          '[draft-for-user] AI generation failed for lead',
          lead.id,
          '— using template',
        );
      }

      const id = `em_${Math.random().toString(36).slice(2, 12)}`;
      const record = {
        id,
        userId,
        leadId: lead.id,
        inboxId,
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

      await db.collection('emails').doc(id).set(record);
      drafted++;
    } catch (err) {
      console.warn('[draft-for-user] skipped lead', lead.id, err);
      skipped++;
    }
  }

  return { drafted, skipped, alreadyDrafted: false };
}
