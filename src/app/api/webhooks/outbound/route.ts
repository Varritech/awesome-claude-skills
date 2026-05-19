/**
 * POST /api/webhooks/outbound
 *
 * User-configured outbound webhook.
 * When an email event fires (send/open/reply), POST a JSON payload to
 * the user's configured webhookUrl (stored on the user profile).
 *
 * This endpoint is called internally by Inngest functions or API routes
 * that want to dispatch webhook payloads.
 *
 * Payload: { userId, eventType: 'sent'|'opened'|'replied'|'bounced', emailId, metadata? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseAndValidate, requireUser, logRequest } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const outboundWebhookSchema = z.object({
  eventType: z.enum(['sent', 'opened', 'replied', 'bounced']),
  emailId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('webhooks.outbound.POST', userId);

  const parsed = await parseAndValidate(req, outboundWebhookSchema);
  if (parsed.response) return parsed.response;
  const { eventType, emailId, metadata } = parsed.data;

  // Load user's configured webhookUrl
  const userSnap = await adminDb.collection('users').doc(userId).get();
  const webhookUrl = userSnap.data()?.webhookUrl as string | undefined;

  if (!webhookUrl) {
    return NextResponse.json({ data: { dispatched: false, reason: 'No webhook URL configured' } });
  }

  const payload = {
    eventType,
    emailId,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json({
      data: { dispatched: true, status: response.status },
    });
  } catch (err) {
    return NextResponse.json({
      data: { dispatched: false, reason: String(err) },
    });
  }
}
