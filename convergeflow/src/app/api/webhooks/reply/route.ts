/**
 * /api/webhooks/reply - inbound reply notification handler.
 *
 * Called by the email provider (e.g. Mailforge) when a lead replies.
 * Updates email + lead status to 'replied' and sets the leadSequenceState
 * replied flag so shouldStopSequence() halts further follow-ups.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ReplyPayload {
  emailId: string;
  messageId?: string;
  from?: string;
  receivedAt?: string;
}

export async function POST(req: NextRequest) {
  let payload: ReplyPayload;
  try {
    payload = (await req.json()) as ReplyPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { emailId } = payload;
  if (!emailId) {
    return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });
  }

  try {
    const emailSnap = await adminDb.collection('emails').doc(emailId).get();
    if (!emailSnap.exists) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const email = emailSnap.data() as { leadId?: string; campaignId?: string };
    const now = new Date().toISOString();

    await adminDb.collection('emails').doc(emailId).set(
      { status: 'replied', repliedAt: now, updatedAt: now },
      { merge: true },
    );

    if (email.leadId) {
      await adminDb.collection('leads').doc(email.leadId).set(
        { status: 'replied', updatedAt: now },
        { merge: true },
      );

      if (email.campaignId) {
        await adminDb
          .collection('leadSequenceState')
          .doc(`${email.leadId}_${email.campaignId}`)
          .set({ replied: true, repliedAt: now }, { merge: true });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhooks.reply] handler error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
