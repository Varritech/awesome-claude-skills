/**
 * POST /api/webhooks/resend
 *
 * Single inbound endpoint for every Resend webhook event. Resend signs
 * payloads with Svix (https://resend.com/docs/dashboard/webhooks/svix),
 * so we verify with the Svix SDK against `RESEND_WEBHOOK_SECRET`.
 *
 * Event types we care about:
 *   email.bounced     → mark email as bounced, decrement inbox health
 *   email.complained  → increment inbox complaint counters, suspend if rate too high
 *   email.delivered   → stamp deliveredAt on the email doc
 *   email.opened      → increment open count + stamp lastOpenedAt
 *   email.clicked     → increment click count + stamp lastClickedAt
 *   email.received    → inbound reply → fire email/reply-received Inngest event
 *
 * Other event types are accepted with a 200 + ignored so Resend doesn't
 * retry them forever.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'svix';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';
import { jsonError, logRequest } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

// Threshold above which we automatically suspend an inbox (0.1% spam complaint
// rate is the Gmail/Yahoo published cut-off — anything higher and our domain
// reputation starts taking real damage across all customers on the same IP).
const COMPLAINT_SUSPEND_THRESHOLD = 0.001;

interface ResendEventBase {
  type: string;
  created_at?: string;
  data: Record<string, unknown>;
}

interface ResendEmailMeta {
  email_id?: string;
  to?: string[];
  from?: string;
  subject?: string;
  /**
   * Headers Resend echoes back from the original send. We stamp a custom
   * `X-Convergeflow-Email-Id` on every outbound message so we can look up
   * the Firestore email doc without depending on Resend's id.
   */
  headers?: Array<{ name: string; value: string }>;
}

interface ResendBouncedData extends ResendEmailMeta {
  bounce?: {
    type?: string;
    subType?: string;
    message?: string;
  };
}

interface ResendComplainedData extends ResendEmailMeta {
  complaint?: { feedback?: string };
}

interface ResendOpenedData extends ResendEmailMeta {
  open?: { timestamp?: string; user_agent?: string; ip_address?: string };
}

interface ResendClickedData extends ResendEmailMeta {
  click?: { timestamp?: string; link?: string; ip_address?: string };
}

interface ResendInboundData {
  /** Resend assigns its own id for inbound mail; not the original send id. */
  email_id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  html?: string;
  /** When the inbound message is a reply, the original message id appears here. */
  in_reply_to?: string;
  /** ConvergeFlow stamps a custom header on outbound; Resend echoes it. */
  headers?: Array<{ name: string; value: string }>;
}

function findConvergeflowEmailId(headers?: Array<{ name: string; value: string }>): string | null {
  if (!headers) return null;
  const match = headers.find((h) => h.name.toLowerCase() === 'x-convergeflow-email-id');
  return match?.value ?? null;
}

/**
 * Find the Firestore email doc id this webhook event refers to. Prefers the
 * custom X-Convergeflow-Email-Id header we stamp on outbound mail, falls
 * back to Resend's own email_id (which we persist as resendMessageId).
 */
async function resolveEmailId(meta: ResendEmailMeta): Promise<string | null> {
  const cfId = findConvergeflowEmailId(meta.headers);
  if (cfId) return cfId;

  if (!meta.email_id) return null;
  const snap = await adminDb
    .collection('emails')
    .where('resendMessageId', '==', meta.email_id)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0]!.id;
}

async function handleBounced(data: ResendBouncedData): Promise<void> {
  const emailId = await resolveEmailId(data);
  if (!emailId) return;

  const reason = [data.bounce?.type, data.bounce?.subType, data.bounce?.message]
    .filter(Boolean)
    .join(' / ');

  await adminDb
    .collection('emails')
    .doc(emailId)
    .set(
      {
        status: 'bounced',
        bouncedAt: new Date().toISOString(),
        bounceReason: reason || 'unknown',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function handleComplained(data: ResendComplainedData): Promise<void> {
  const emailId = await resolveEmailId(data);
  if (!emailId) return;

  const emailSnap = await adminDb.collection('emails').doc(emailId).get();
  if (!emailSnap.exists) return;
  const email = emailSnap.data() as { inboxId?: string };
  if (!email.inboxId) return;

  await adminDb
    .collection('emails')
    .doc(emailId)
    .set(
      {
        complainedAt: new Date().toISOString(),
        complaintFeedback: data.complaint?.feedback ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  const inboxRef = adminDb.collection('inboxes').doc(email.inboxId);
  const inboxSnap = await inboxRef.get();
  if (!inboxSnap.exists) return;

  const inboxData = inboxSnap.data() as {
    totalSent?: number;
    totalComplaints?: number;
  };
  const totalSent = inboxData.totalSent ?? 1;
  const newComplaints = (inboxData.totalComplaints ?? 0) + 1;
  const complaintRate = totalSent > 0 ? newComplaints / totalSent : 0;

  await inboxRef.set(
    {
      totalComplaints: newComplaints,
      complaintRate,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  if (complaintRate > COMPLAINT_SUSPEND_THRESHOLD) {
    await inngest.send({
      name: 'inbox/suspend',
      data: { inboxId: email.inboxId, reason: 'high_complaint_rate', complaintRate },
    });
  }
}

async function handleDelivered(data: ResendEmailMeta): Promise<void> {
  const emailId = await resolveEmailId(data);
  if (!emailId) return;
  await adminDb
    .collection('emails')
    .doc(emailId)
    .set(
      {
        deliveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function handleOpened(data: ResendOpenedData): Promise<void> {
  const emailId = await resolveEmailId(data);
  if (!emailId) return;
  const ref = adminDb.collection('emails').doc(emailId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const cur = snap.data() as { openCount?: number };
  await ref.set(
    {
      openCount: (cur.openCount ?? 0) + 1,
      lastOpenedAt: data.open?.timestamp ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function handleClicked(data: ResendClickedData): Promise<void> {
  const emailId = await resolveEmailId(data);
  if (!emailId) return;
  const ref = adminDb.collection('emails').doc(emailId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const cur = snap.data() as { clickCount?: number };
  await ref.set(
    {
      clickCount: (cur.clickCount ?? 0) + 1,
      lastClickedAt: data.click?.timestamp ?? new Date().toISOString(),
      lastClickedLink: data.click?.link ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function handleInbound(data: ResendInboundData): Promise<void> {
  // Prefer the custom header (carried through by Resend on replies),
  // otherwise fall back to in_reply_to which references the Message-ID
  // of the email we sent.
  let originalEmailId = findConvergeflowEmailId(data.headers);

  if (!originalEmailId && data.in_reply_to) {
    const snap = await adminDb
      .collection('emails')
      .where('messageId', '==', data.in_reply_to)
      .limit(1)
      .get();
    if (!snap.empty) originalEmailId = snap.docs[0]!.id;
  }

  if (!originalEmailId) return; // unmatched reply — ignore silently

  const emailSnap = await adminDb.collection('emails').doc(originalEmailId).get();
  if (!emailSnap.exists) return;

  const email = emailSnap.data() as {
    userId: string;
    leadId?: string;
    campaignId?: string;
  };
  if (!email.leadId || !email.campaignId) return;

  const replyText = (data.text ?? '').slice(0, 4000);

  await inngest.send({
    name: 'email/reply-received',
    data: {
      emailId: originalEmailId,
      leadId: email.leadId,
      campaignId: email.campaignId,
      replyText,
      userId: email.userId,
    },
  });
}

export async function POST(req: NextRequest) {
  logRequest('webhooks.resend.POST', 'system');

  const body = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  let event: ResendEventBase;
  if (secret) {
    try {
      const wh = new Webhook(secret);
      event = wh.verify(body, {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      }) as ResendEventBase;
    } catch (err) {
      console.warn('[webhooks.resend] Svix verification failed', err);
      return jsonError('Invalid signature', 401);
    }
  } else {
    // Local dev / unset secret — accept unsigned payloads so Resend's "send
    // test event" button works before the secret is wired in env.
    try {
      event = JSON.parse(body) as ResendEventBase;
    } catch {
      return jsonError('Invalid JSON body', 400);
    }
  }

  try {
    switch (event.type) {
      case 'email.bounced':
        await handleBounced(event.data as ResendBouncedData);
        break;
      case 'email.complained':
        await handleComplained(event.data as ResendComplainedData);
        break;
      case 'email.delivered':
        await handleDelivered(event.data as ResendEmailMeta);
        break;
      case 'email.opened':
        await handleOpened(event.data as ResendOpenedData);
        break;
      case 'email.clicked':
        await handleClicked(event.data as ResendClickedData);
        break;
      case 'email.received':
        await handleInbound(event.data as ResendInboundData);
        break;
      default:
        // Unknown event type — ack so Resend doesn't retry.
        break;
    }
  } catch (err) {
    console.error('[webhooks.resend] handler threw', err, { type: event.type });
    return jsonError('Handler error', 500);
  }

  return NextResponse.json({ ok: true, type: event.type });
}
