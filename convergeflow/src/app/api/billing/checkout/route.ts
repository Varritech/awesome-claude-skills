/**
 * /api/billing/checkout - create a Stripe Checkout session.
 *
 * TODO: Real implementation:
 *   - Look up / create a Stripe customer for the Clerk userId.
 *   - Map `tier` -> priceId from env (STRIPE_PRICE_SELF_SERVE, ...).
 *   - Call `stripe.checkout.sessions.create()` with metadata.userId.
 *   - Handle openclaw_dwy tier via sales-led flow (return a Calendly URL
 *     instead of a Stripe session).
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { checkoutSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const PRICE_LOOKUP: Record<string, string | null> = {
  self_serve: process.env.STRIPE_PRICE_SELF_SERVE ?? 'price_placeholder_self_serve_monthly',
  openclaw_dwy: process.env.STRIPE_PRICE_OPENCLAW_DWY ?? null, // sales-led
  enterprise: null, // sales-led
};

const SALES_URL = 'https://cal.com/varritech/convergeflow-intro';

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, checkoutSchema);
  if (parsed.response) return parsed.response;
  const { tier, successUrl, cancelUrl } = parsed.data;

  logRequest('billing.checkout.POST', userId, { tier });

  const priceId = PRICE_LOOKUP[tier];
  if (!priceId) {
    return NextResponse.json({
      data: {
        tier,
        mode: 'sales_led',
        scheduleUrl: SALES_URL,
      },
    });
  }

  // TODO: replace placeholder with stripe.checkout.sessions.create().
  const secretConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  if (!secretConfigured) {
    console.info(
      '[api:billing.checkout] STRIPE_SECRET_KEY not set, returning placeholder session',
    );
    return NextResponse.json({
      data: {
        tier,
        mode: 'placeholder',
        sessionId: `cs_placeholder_${Math.random().toString(36).slice(2, 12)}`,
        url: successUrl ?? 'https://checkout.stripe.com/pay/placeholder',
        cancelUrl: cancelUrl ?? null,
        priceId,
      },
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2024-06-20',
    });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        successUrl ?? 'https://convergeflow.io/dashboard?checkout=success',
      cancel_url: cancelUrl ?? 'https://convergeflow.io/pricing',
      client_reference_id: userId,
      metadata: { userId, tier },
    });
    return NextResponse.json({
      data: { tier, mode: 'live', sessionId: session.id, url: session.url },
    });
  } catch (err) {
    console.error('[api:billing.checkout] stripe error', err);
    return jsonError('Failed to create checkout session', 502);
  }
}
