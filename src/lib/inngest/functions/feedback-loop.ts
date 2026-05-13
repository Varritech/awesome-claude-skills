/**
 * Inngest function: email/positive-reply
 *
 * Feedback loop — when an email receives a positive reply, extract
 * the email + context and add it to the RAG knowledge base as a
 * high-signal winning example (Mechanism 1 from PRD §9).
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { embed } from '@/lib/rag/embeddings';

export const feedbackLoopFn = inngest.createFunction(
  {
    id: 'feedback-loop',
    name: 'RAG Feedback Loop — Store Winning Email',
    retries: 2,
    triggers: [{ event: 'email/positive-reply' }],
  },
  async ({ event, step }) => {
    const { emailId, leadId, campaignId, userId } = event.data as {
      emailId: string;
      leadId: string;
      campaignId: string;
      userId: string;
    };

    // ── 1. Load winning email + lead context ─────────────────────────────────
    const ctx = await step.run('load-context', async () => {
      const [emailSnap, leadSnap, campaignSnap] = await Promise.all([
        adminDb.collection('emails').doc(emailId).get(),
        adminDb.collection('leads').doc(leadId).get(),
        adminDb.collection('campaigns').doc(campaignId).get(),
      ]);
      return {
        emailExists: emailSnap.exists,
        email: emailSnap.exists ? (emailSnap.data() as { subject: string; body: string; persona?: string }) : null,
        lead: leadSnap.exists ? (leadSnap.data() as Record<string, unknown>) : {},
        campaign: campaignSnap.exists ? (campaignSnap.data() as Record<string, unknown>) : {},
      };
    });

    if (!ctx.emailExists || !ctx.email) return { skipped: true, reason: 'email not found' };

    const { email, lead, campaign } = ctx;

    // ── 2. Build knowledge chunk text ─────────────────────────────────────────
    const chunkText = [
      `WINNING EMAIL EXAMPLE`,
      `Industry: ${(lead.industry as string) ?? 'unknown'}`,
      `Company size: ${(lead.estimatedSize as string) ?? 'unknown'}`,
      `Campaign offer: ${(campaign.offer as string) ?? 'unknown'}`,
      `Subject: ${email.subject}`,
      `Body:`,
      email.body,
      `Result: positive reply received`,
    ].join('\n');

    // ── 3. Embed the chunk ────────────────────────────────────────────────────
    const embedding = await step.run('embed-chunk', async () => {
      return embed(chunkText);
    });

    // ── 4. Store in Firebase rag_examples collection ──────────────────────────
    await step.run('store-example', async () => {
      await adminDb.collection('rag_examples').add({
        type: 'winning_email',
        framework: 'example',
        industry: (lead.industry as string) ?? null,
        text: chunkText,
        embedding,
        emailId,
        leadId,
        campaignId,
        userId,
        createdAt: new Date().toISOString(),
      });
    });

    return { emailId, stored: true, textLength: chunkText.length };
  }
);
