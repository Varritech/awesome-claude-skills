/**
 * /api/webhooks/stripe - Stripe webhook handler.
 *
 * Handles:
 *   - checkout.session.completed   -> seed users/{id}.stripeCustomerId + tier
 *   - customer.subscription.created / updated / deleted
 *
 * TODO: Verify signature with STRIPE_WEBHOOK_SECRET once set.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface StripeEventLite {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

const TIER_BY_PRICE: Record<string, 'self_serve' | 'openclaw_dwy' | 'enterprise'> = {
  [process.env.STRIPE_PRICE_SELF_SERVE ?? '']: 'self_serve',
  [process.env.STRIPE_PRICE_OPENCLAW_DWY ?? '']: 'openclaw_dwy',
};

async function parseAndVerify(req: NextRequest): Promise<StripeEventLite | null> {
  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');

  if (!secret || !signature) {
    // Placeholder mode: accept the raw body as JSON without signature checks.
    try {
      return JSON.parse(body) as StripeEventLite;
    } catch {
      return null;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2024-06-20',
    });
    return stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error('[webhooks.stripe] signature verification failed', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const event = await parseAndVerify(req);
  if (!event) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  console.info('[webhooks.stripe] event', { id: event.id, type: event.type });
  const obj = (event.data?.object ?? {}) as Record<string, unknown>;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId =
          (obj.client_reference_id as string | undefined) ??
          (((obj.metadata as Record<string, string> | undefined) ?? {}).userId ??
            null);
        const customerId = obj.customer as string | undefined;
        const subscriptionId = obj.subscription as string | undefined;
        if (userId) {
          await adminDb.collection('users').doc(userId).set(
            {
              stripeCustomerId: customerId ?? null,
              stripeSubscriptionId: subscriptionId ?? null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = obj as {
          id: string;
          status: string;
          customer: string;
          items?: { data?: Array<{ price?: { id?: string } }> };
          metadata?: { userId?: string };
          cancel_at_period_end?: boolean;
          current_period_end?: number;
        };
        const priceId = subscription.items?.data?.[0]?.price?.id ?? '';
        const tier = TIER_BY_PRICE[priceId] ?? 'self_serve';
        const userId = subscription.metadata?.userId;
        if (userId) {
          await adminDb.collection('users').doc(userId).set(
            {
              tier,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              renewsAt: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = obj as { metadata?: { userId?: string } };
        const userId = subscription.metadata?.userId;
        if (userId) {
          await adminDb.collection('users').doc(userId).set(
            {
              tier: 'self_serve',
              subscriptionStatus: 'canceled',
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        break;
      }
      default:
        // Ignore other event types for now.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhooks.stripe] handler error', err);
    // Return 200 so Stripe doesn't retry when the error is on our side
    // (e.g. Firestore not configured yet in placeholder mode).
    return NextResponse.json({ received: true, warning: 'handler_failed' });
  }
}
