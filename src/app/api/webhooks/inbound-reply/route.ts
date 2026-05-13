/**
 * POST /api/webhooks/inbound-reply
 *
 * Receives inbound reply notifications from Mailforge.
 * Looks up the original email by messageId, then fires email/reply-received
 * to Inngest for classification and routing.
 *
 * Mailforge sends: { messageId, replyText, from, timestamp }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

interface MailforgeReplyPayload {
  messageId: string;
  replyText: string;
  from: string;
  subject?: string;
  timestamp?: string;
}

export async function POST(req: NextRequest) {
  let payload: MailforgeReplyPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messageId, replyText } = payload;
  if (!messageId || !replyText) {
    return NextResponse.json({ error: 'messageId and replyText required' }, { status: 400 });
  }

  // Look up original email by messageId
  const snap = await adminDb
    .collection('emails')
    .where('messageId', '==', messageId)
    .limit(1)
    .get();

  if (snap.empty) {
    // Not from a ConvergeFlow campaign — ignore silently
    return NextResponse.json({ ok: true, matched: false });
  }

  const emailDoc = snap.docs[0]!;
  const email = emailDoc.data() as {
    userId: string;
    leadId?: string;
    campaignId?: string;
  };

  if (!email.leadId || !email.campaignId) {
    return NextResponse.json({ ok: true, matched: true, queued: false });
  }

  await inngest.send({
    name: 'email/reply-received',
    data: {
      emailId: emailDoc.id,
      leadId: email.leadId,
      campaignId: email.campaignId,
      replyText: replyText.slice(0, 4000), // cap at 4k chars
      userId: email.userId,
    },
  });

  return NextResponse.json({ ok: true, matched: true, queued: true });
}
