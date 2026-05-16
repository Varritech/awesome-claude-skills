/**
 * POST /api/webhooks/complaint
 *
 * Receives Mailforge complaint webhooks.
 * Updates inbox complaintRate; if it exceeds 0.1%, fires inbox/suspend Inngest event.
 *
 * Payload: { inboxId: string, complaintType: string, count: number }
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logRequest, jsonError } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

const complaintSchema = z.object({
  inboxId: z.string().min(1),
  complaintType: z.string().default('spam'),
  count: z.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  logRequest('webhooks.complaint.POST', 'system');

  const secret = process.env.MAILFORGE_WEBHOOK_SECRET;
  const body = await req.text();

  if (secret) {
    const sig = req.headers.get('x-mailforge-signature') ?? '';
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return jsonError('Invalid signature', 401);
    }
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const result = complaintSchema.safeParse(raw);
  if (!result.success) {
    return jsonError('Validation failed', 400, result.error.flatten());
  }
  const { inboxId, count } = result.data;

  // Load inbox
  const inboxRef = adminDb.collection('inboxes').doc(inboxId);
  const snap = await inboxRef.get();
  if (!snap.exists) {
    return jsonError('Inbox not found', 404);
  }

  const inboxData = snap.data()!;
  const totalSent = (inboxData.totalSent as number) ?? 1;
  const currentComplaints = (inboxData.totalComplaints as number) ?? 0;
  const newComplaints = currentComplaints + count;
  const complaintRate = totalSent > 0 ? newComplaints / totalSent : 0;

  await inboxRef.set(
    {
      totalComplaints: newComplaints,
      complaintRate,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  // If complaint rate exceeds 0.1%, fire suspension event
  if (complaintRate > 0.001) {
    await inngest.send({
      name: 'inbox/suspend',
      data: { inboxId, reason: 'high_complaint_rate', complaintRate },
    });
  }

  return NextResponse.json({ data: { inboxId, complaintRate, suspended: complaintRate > 0.001 } });
}
