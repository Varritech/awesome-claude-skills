/**
 * Inngest cron: daily-auto-send
 *
 * Runs at 8:05 AM UTC every day (5 min after lead refresh completes).
 * For every user that has leads in Firestore:
 *   1. Reads their saved persona (preferredStyle) from users/{userId}
 *   2. Generates a personalized email per lead via Ollama
 *   3. Writes queued email records to Firestore
 *   4. Fires email/send events for each (send-email fn handles SMTP + warmup)
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { chat } from '@/lib/ollama/client';
import { randomSendDelay } from '@/lib/warmup/scheduler';

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

function buildPrompt(persona: Persona, lead: LeadDoc): string {
  const firstName = lead.firstName ?? 'there';
  const company = lead.company ?? 'your company';
  const title = lead.title ?? '';
  const industry = lead.industry ?? '';

  return [
    PERSONA_SYSTEM[persona],
    '',
    `Write a cold outreach email to ${firstName}${title ? `, ${title}` : ''}${company ? ` at ${company}` : ''}.`,
    industry ? `Industry: ${industry}.` : '',
    '',
    'Return ONLY valid JSON with two keys: "subject" (string, ≤60 chars) and "body" (string, plain text, 3-5 short paragraphs, use {{firstName}} as the greeting placeholder).',
    'No markdown. No explanation. Just the JSON object.',
  ]
    .filter(Boolean)
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

interface UserProfile {
  preferredStyle?: string;
  industry?: string;
}

interface InboxDoc {
  id: string;
  userId: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
}

export const dailyAutoSendFn = inngest.createFunction(
  {
    id: 'daily-auto-send',
    name: 'Daily Auto Send',
    retries: 2,
    triggers: [{ cron: '5 8 * * *' }],
  },
  async ({ step }) => {
    // ── 1. Collect all users with new leads ───────────────────────────────────
    const userIds = await step.run('collect-users', async () => {
      const snap = await adminDb
        .collection('leads')
        .where('status', '==', 'new')
        .select('userId')
        .get();
      const ids = new Set<string>();
      snap.docs.forEach((d) => {
        const uid = d.data().userId as string | undefined;
        if (uid) ids.add(uid);
      });
      return Array.from(ids);
    });

    if (userIds.length === 0) return { processed: 0 };

    let processed = 0;

    for (const userId of userIds) {
      const emailIds = await step.run(`draft-and-queue-${userId}`, async () => {
        // Load profile: persona + inbox
        const [profileDoc, inboxSnap, leadsSnap] = await Promise.all([
          adminDb.collection('users').doc(userId).get(),
          adminDb
            .collection('inboxes')
            .where('userId', '==', userId)
            .where('status', 'in', ['warming', 'active'])
            .limit(1)
            .get(),
          adminDb
            .collection('leads')
            .where('userId', '==', userId)
            .where('status', '==', 'new')
            .limit(20)
            .get(),
        ]);

        const profile = profileDoc.data() as UserProfile | undefined;
        const rawStyle = profile?.preferredStyle ?? 'neighbor';
        const persona: Persona = (rawStyle in PERSONA_SYSTEM ? rawStyle : 'neighbor') as Persona;

        if (inboxSnap.empty) return []; // no active inbox — skip

        const inbox = { id: inboxSnap.docs[0].id, ...inboxSnap.docs[0].data() } as InboxDoc;
        const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadDoc));

        if (leads.length === 0) return [];

        const now = new Date().toISOString();
        const ids: string[] = [];
        const batch = adminDb.batch();

        for (const lead of leads) {
          try {
            const prompt = buildPrompt(persona, lead);
            const raw = await chat([{ role: 'user', content: prompt }]);
            const cleaned = raw.replace(/^```(?:json)?|```$/gm, '').trim();

            let subject = `Following up — ${lead.company ?? lead.firstName ?? 'you'}`;
            let body = cleaned;

            try {
              const parsed = JSON.parse(cleaned);
              if (parsed.subject) subject = String(parsed.subject).slice(0, 60);
              if (parsed.body) body = String(parsed.body);
            } catch {
              // model didn't return JSON — use raw as body
            }

            const id = `em_${Math.random().toString(36).slice(2, 12)}`;
            batch.set(adminDb.collection('emails').doc(id), {
              id,
              userId,
              leadId: lead.id,
              inboxId: inbox.id,
              campaignId: null,
              subject,
              body,
              persona,
              status: 'queued',
              createdAt: now,
              updatedAt: now,
              sentAt: null,
              deletedAt: null,
            });
            ids.push(id);
          } catch (err) {
            console.warn('[daily-auto-send] draft failed for lead', lead.id, err);
          }
        }

        await batch.commit();
        return ids;
      });

      // Fire send events with warmup-aware pacing
      if (emailIds.length > 0) {
        // Load inbox id for the user (need it for the send event)
        const inboxSnap = await step.run(`get-inbox-${userId}`, async () => {
          const snap = await adminDb
            .collection('inboxes')
            .where('userId', '==', userId)
            .where('status', 'in', ['warming', 'active'])
            .limit(1)
            .get();
          if (snap.empty) return null;
          return snap.docs[0].id;
        });

        if (inboxSnap) {
          await step.sendEvent(
            `send-emails-${userId}`,
            emailIds.map((emailId, i) => ({
              name: 'email/send' as const,
              data: { emailId, inboxId: inboxSnap, userId },
              ts: Date.now() + randomSendDelay(8) + i * 5_000,
            })),
          );
        }
      }

      processed++;
    }

    return { processed };
  },
);
