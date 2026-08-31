/**
 * /api/billing/subscription - current subscription snapshot.
 *
 * Returns the shape expected by the payments page:
 * { plans[], currentPlanId, paymentMethod }
 *
 * tier → currentPlanId mapping:
 *   self_serve     → "starter"
 *   openclaw_dwy   → "pro"
 *   enterprise     → "scale"
 *
 * TODO: Replace mock with stripe.subscriptions.retrieve(user.subscriptionId)
 * once users[].stripeCustomerId / stripeSubscriptionId are being written in
 * the checkout-success webhook.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

type Tier = 'self_serve' | 'openclaw_dwy' | 'enterprise';

const TIER_TO_PLAN_ID: Record<Tier, string> = {
  self_serve: 'starter',
  openclaw_dwy: 'pro',
  enterprise: 'scale',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    period: 'mo',
    emails: '50 emails/day',
    features: [
      '1 connected inbox',
      '1 sending domain',
      '1 email style',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 149,
    period: 'mo',
    emails: '500 emails/day',
    features: [
      '5 connected inboxes',
      '3 sending domains',
      'All email styles',
      'Advanced analytics',
      'Priority support',
      'A/B testing',
    ],
    popular: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 399,
    period: 'mo',
    emails: 'Unlimited emails',
    features: [
      'Unlimited inboxes',
      'Unlimited domains',
      'All email styles',
      'Full analytics suite',
      'Dedicated support',
      'A/B testing',
      'API access',
      'Custom integrations',
    ],
  },
];

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('billing.subscription.GET', userId);

  let tier: Tier = 'self_serve';

  try {
    const doc = await adminDb.collection('users').doc(userId).get();
    if (doc.exists) {
      const user = doc.data() as { tier?: Tier };
      tier = user.tier ?? 'self_serve';
    }
  } catch (err) {
    console.warn('[api:billing.subscription.GET] falling back to default tier', err);
  }

  return NextResponse.json({
    data: {
      plans: PLANS,
      currentPlanId: TIER_TO_PLAN_ID[tier] ?? 'starter',
      paymentMethod: null,
    },
  });
}
