/**
 * /api/webhooks/clerk - Clerk webhook handler.
 *
 * Primary job: when `user.created` fires, create the mirrored user doc
 * at Firestore `users/{clerkUserId}` with default tier + onboarding state.
 * We also handle `user.updated` (sync email/name changes) and
 * `user.deleted` (soft-delete).
 *
 * TODO: Verify the Svix signature once CLERK_WEBHOOK_SECRET is set.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ClerkEvent {
  type: string;
  data: Record<string, unknown> & {
    id?: string;
    email_addresses?: Array<{ email_address?: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

async function verifyAndParse(req: NextRequest): Promise<ClerkEvent | null> {
  const body = await req.text();
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!secret || !svixId || !svixTimestamp || !svixSignature) {
    // Placeholder mode: accept unsigned bodies.
    try {
      return JSON.parse(body) as ClerkEvent;
    } catch {
      return null;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Webhook } = require('svix');
    const wh = new Webhook(secret);
    return wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('[webhooks.clerk] signature verification failed', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const event = await verifyAndParse(req);
  if (!event) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const userId = event.data.id;
  console.info('[webhooks.clerk] event', { type: event.type, userId });

  if (!userId) {
    return NextResponse.json({ received: true, warning: 'missing_user_id' });
  }

  const primaryEmail = event.data.email_addresses?.[0]?.email_address ?? null;
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case 'user.created':
        await adminDb.collection('users').doc(userId).set(
          {
            id: userId,
            email: primaryEmail,
            firstName: event.data.first_name ?? null,
            lastName: event.data.last_name ?? null,
            imageUrl: event.data.image_url ?? null,
            tier: 'self_serve',
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );
        await adminDb.collection('onboarding').doc(userId).set(
          {
            userId,
            step: 'profile',
            completed: false,
            stepsCompleted: {},
            updatedAt: now,
          },
          { merge: true },
        );
        break;

      case 'user.updated':
        await adminDb.collection('users').doc(userId).set(
          {
            email: primaryEmail,
            firstName: event.data.first_name ?? null,
            lastName: event.data.last_name ?? null,
            imageUrl: event.data.image_url ?? null,
            updatedAt: now,
          },
          { merge: true },
        );
        break;

      case 'user.deleted':
        await adminDb.collection('users').doc(userId).set(
          { deletedAt: now, updatedAt: now },
          { merge: true },
        );
        break;

      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhooks.clerk] handler error', err);
    return NextResponse.json({ received: true, warning: 'handler_failed' });
  }
}
