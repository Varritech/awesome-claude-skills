/**
 * GET /api/domains/search?q=<query>
 *
 * Proxies a single Cloud Domains availability search so the onboarding UI
 * can show "is this domain available + how much per year" without exposing
 * the GCP credentials to the browser.
 *
 * Response shape:
 *   { data: [{ domainName, availability, yearlyPriceUsdCents }, ...] }
 *
 * Availability values from Cloud Domains:
 *   AVAILABLE          → can register right now
 *   MAYBE_AVAILABLE    → likely available; needs a deeper check at register time
 *   UNAVAILABLE        → already registered or restricted
 *   UNSUPPORTED        → TLD not supported by Cloud Domains
 *   UNKNOWN            → upstream did not return a definitive answer
 *
 * We apply the markup at the API layer rather than exposing the raw
 * upstream price — the onboarding UI quotes the customer the price they
 * will see on the Stripe invoice.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { logRequest, requireUser } from '@/lib/api/helpers';
import * as cloudDomains from '@/lib/gcp/cloud-domains';

export const dynamic = 'force-dynamic';

/**
 * Markup applied to the upstream registrar price. ConvergeFlow charges
 * (cost + DOMAIN_MARKUP_CENTS) per year. Customers pay through Stripe;
 * GCP charges ConvergeFlow for the cost portion automatically. Keeping
 * the markup as a flat constant (rather than a percentage) keeps the
 * pricing math predictable across short TLDs (.io ~$30) and cheap TLDs
 * (.com ~$12).
 */
const DOMAIN_MARKUP_CENTS = 1000; // $10/yr markup

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  if (!q || q.length < 3) {
    return NextResponse.json({ error: 'Query must be at least 3 characters' }, { status: 400 });
  }
  if (!/^[a-z0-9.-]+$/i.test(q)) {
    return NextResponse.json({ error: 'Invalid domain characters' }, { status: 400 });
  }

  logRequest('domains.search.GET', userId, { q });

  if (!cloudDomains.isConfigured()) {
    return NextResponse.json(
      { error: 'Domain registration is not configured on this deployment' },
      { status: 503 },
    );
  }

  try {
    const results = await cloudDomains.searchDomains(q);
    const annotated = results.map((r) => ({
      domainName: r.domainName,
      availability: r.availability,
      yearlyCostUsdCents: r.yearlyPriceUsdCents,
      yearlyPriceUsdCents:
        typeof r.yearlyPriceUsdCents === 'number'
          ? r.yearlyPriceUsdCents + DOMAIN_MARKUP_CENTS
          : undefined,
      markupUsdCents: DOMAIN_MARKUP_CENTS,
    }));
    return NextResponse.json({ data: annotated });
  } catch (err) {
    console.error('[api:domains.search] cloudDomains.searchDomains failed', err);
    return NextResponse.json(
      { error: 'Domain availability lookup failed. Try again in a moment.' },
      { status: 502 },
    );
  }
}
