/**
 * /api/billing/subscription - current subscription snapshot.
 *
 * TODO: Replace mock with `stripe.subscriptions.retrieve(user.subscriptionId)`
 * once users[].stripeCustomerId / stripeSubscriptionId are being written in
 * the checkout-success webhook.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

type Tier = 'self_serve' | 'openclaw_dwy' | 'enterprise';

interface SubscriptionSnapshot {
  userId: string;
  tier: Tier;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'none';
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  priceId?: string;
  seats?: number;
}

function mockSubscription(userId: string): SubscriptionSnapshot {
  return {
    userId,
    tier: 'self_serve',
    status: 'trialing',
    renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    cancelAtPeriodEnd: false,
    priceId: 'price_placeholder_self_serve_monthly',
    seats: 1,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('billing.subscription.GET', userId);

  try {
    const doc = await adminDb.collection('users').doc(userId).get();
    if (!doc.exists) {
      return NextResponse.json({ data: mockSubscription(userId) });
    }
    const user = doc.data() as { tier?: Tier; stripeSubscriptionId?: string };
    // TODO: if user.stripeSubscriptionId: fetch live from Stripe.
    return NextResponse.json({
      data: {
        ...mockSubscription(userId),
        tier: user.tier ?? 'self_serve',
      },
    });
  } catch (err) {
    console.warn('[api:billing.subscription.GET] falling back to mock', err);
    return NextResponse.json({ data: mockSubscription(userId) });
  }
}
