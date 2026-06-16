/**
 * POST /api/domains/buy
 *
 * "Buy a fresh sending domain" flow.
 *
 * Inputs: domain, full WHOIS contact (phone, email, name, address).
 * Outputs: Firestore domain doc id + the Cloud Domains long-running
 *          operation name. The dashboard polls /api/domains/[id]/verify
 *          which now also surfaces the operation status.
 *
 * Sequence:
 *   1. Validate the input + verify the price hasn't changed since the
 *      availability lookup.
 *   2. Call Cloud Domains `registrations:register` with the customer's
 *      contact info — they end up as the WHOIS registrant.
 *   3. Create a Cloud DNS managed zone for the domain so we can write
 *      Resend's SPF/DKIM/DMARC records as soon as registration completes.
 *   4. Add the domain to Resend (BYO endpoint) so we get the DKIM key.
 *   5. Write SPF/DKIM/DMARC + MX records into the Cloud DNS zone.
 *   6. Persist a domain doc with provider=`gcp+resend` and the operation
 *      name so the verifier can poll registration progress.
 *
 * Failure handling:
 *   - If Cloud Domains rejects, return 502; nothing is written.
 *   - If Resend rejects after the domain is bought, the registration is
 *     not rolled back (domain ownership has value even if we can't auth
 *     it for sending yet) and we surface the partial state to the user.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { jsonError, logRequest, parseAndValidate, requireUser } from '@/lib/api/helpers';
import * as cloudDomains from '@/lib/gcp/cloud-domains';
import * as cloudDns from '@/lib/gcp/cloud-dns';
import * as resend from '@/lib/resend/client';
import type { ResendDnsRecord } from '@/lib/resend/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // domain registration can take 20-40s

const buySchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Must be a valid domain'),
  /** Price the customer was quoted in cents. We re-fetch and abort if it changed. */
  quotedPriceUsdCents: z.number().int().positive(),
  contact: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email(),
    phone: z
      .string()
      .regex(/^[+]?[\d\s().-]{8,20}$/, 'Enter a valid phone number'),
    addressLine1: z.string().min(1).max(120),
    city: z.string().min(1).max(80),
    state: z.string().min(1).max(80),
    postalCode: z.string().min(1).max(20),
    countryCode: z.string().length(2),
    organization: z.string().max(120).optional(),
  }),
});

const DOMAIN_MARKUP_CENTS = 1000;

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return `+${digits}`;
}

function resendRecordsToDnsRows(
  records: ResendDnsRecord[],
  domain: string,
): Array<{ name: string; ttl: number; type: string; rrdatas: string[] }> {
  return records.map((r) => {
    const name = r.name.endsWith(domain) ? r.name : `${r.name}.${domain}`;
    const ttl = typeof r.ttl === 'number' ? r.ttl : 3600;
    // MX rrdatas need "priority host." shape; everything else is a single quoted
    // string for TXT or bare host for CNAME.
    if (r.type === 'MX') {
      const host = r.value.endsWith('.') ? r.value : `${r.value}.`;
      const priority = r.priority ?? 10;
      return { name, ttl, type: 'MX', rrdatas: [`${priority} ${host}`] };
    }
    if (r.type === 'CNAME') {
      const host = r.value.endsWith('.') ? r.value : `${r.value}.`;
      return { name, ttl, type: 'CNAME', rrdatas: [host] };
    }
    // TXT — Cloud DNS expects each chunk wrapped in quotes
    return { name, ttl, type: 'TXT', rrdatas: [`"${r.value.replace(/"/g, '\\"')}"`] };
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, buySchema);
  if (parsed.response) return parsed.response;
  const { domain, quotedPriceUsdCents, contact } = parsed.data;

  logRequest('domains.buy.POST', userId, { domain, priceCents: quotedPriceUsdCents });

  if (!cloudDomains.isConfigured()) {
    return jsonError('Domain purchase is not configured on this deployment', 503);
  }
  if (!resend.isConfigured()) {
    return jsonError('Email sending provider is not configured', 503);
  }

  // Re-check availability + pricing so a stale quote can't push a registration
  // through at the wrong number.
  const availability = await cloudDomains.searchDomains(domain);
  const match = availability.find((r) => r.domainName === domain);
  if (!match) {
    return jsonError('Domain not returned by availability lookup', 404);
  }
  if (match.availability !== 'AVAILABLE') {
    return jsonError(`Domain is ${match.availability.toLowerCase()}`, 409);
  }
  if (typeof match.yearlyPriceUsdCents !== 'number') {
    return jsonError('Cloud Domains returned no price for this domain', 502);
  }
  const expectedTotal = match.yearlyPriceUsdCents + DOMAIN_MARKUP_CENTS;
  if (expectedTotal !== quotedPriceUsdCents) {
    return NextResponse.json(
      { error: 'price_changed', message: 'The price for this domain changed. Please re-confirm.' , currentPriceUsdCents: expectedTotal },
      { status: 409 },
    );
  }

  const id = `dom_${Math.random().toString(36).slice(2, 12)}`;
  const now = new Date().toISOString();

  // 1. Register the domain — long-running op.
  let operation: cloudDomains.CloudDomainOperation;
  try {
    operation = await cloudDomains.registerDomain({
      domainName: domain,
      yearlyPriceUsdCents: match.yearlyPriceUsdCents,
      contact: {
        privacy: 'REDACTED_CONTACT_DATA',
        registrantContact: {
          phoneNumber: normalizePhone(contact.phone),
          email: contact.email,
          postalAddress: {
            regionCode: contact.countryCode.toUpperCase(),
            administrativeArea: contact.state,
            locality: contact.city,
            postalCode: contact.postalCode,
            addressLines: [contact.addressLine1],
            recipients: [`${contact.firstName} ${contact.lastName}`],
            ...(contact.organization ? { organization: contact.organization } : {}),
          },
        },
      },
    });
  } catch (err) {
    console.error('[api:domains.buy] cloudDomains.registerDomain failed', err);
    return jsonError('Domain registration failed at the registrar', 502);
  }

  // 2. Provision Cloud DNS zone (fast, idempotent).
  let nameServers: string[] = [];
  try {
    const zone = await cloudDns.ensureManagedZone(domain);
    nameServers = zone.nameServers ?? [];
  } catch (err) {
    console.error('[api:domains.buy] cloudDns.ensureManagedZone failed', err);
    // Non-fatal: the operation has already started, surface the partial state.
  }

  // 3. Tell Resend about the domain → get DKIM records.
  let resendDomainId: string | undefined;
  let resendRecords: ResendDnsRecord[] = [];
  try {
    const resendDomain = await resend.createDomain(domain);
    resendDomainId = resendDomain.id;
    resendRecords = resendDomain.records ?? [];
  } catch (err) {
    console.error('[api:domains.buy] resend.createDomain failed', err);
    // Continue — domain is registered, customer can re-trigger auth later.
  }

  // 4. Write the Resend records into the Cloud DNS zone we created.
  if (nameServers.length > 0 && resendRecords.length > 0) {
    try {
      const zoneName = `cf-${domain.replace(/\./g, '-')}`;
      await cloudDns.upsertRecords(zoneName, resendRecordsToDnsRows(resendRecords, domain));
    } catch (err) {
      console.error('[api:domains.buy] cloudDns.upsertRecords failed', err);
    }
  }

  // 5. Persist the domain doc.
  const record = {
    id,
    userId,
    domain,
    purpose: 'sending' as const,
    provider: 'gcp+resend' as const,
    gcpOperationName: operation.name,
    gcpZoneName: `cf-${domain.replace(/\./g, '-')}`,
    nameServers,
    ...(resendDomainId ? { resendDomainId } : {}),
    yearlyCostUsdCents: match.yearlyPriceUsdCents,
    yearlyPriceUsdCents: quotedPriceUsdCents,
    markupUsdCents: DOMAIN_MARKUP_CENTS,
    spfStatus: 'pending' as const,
    dkimStatus: 'pending' as const,
    dmarcStatus: 'pending' as const,
    mxStatus: 'pending' as const,
    overallStatus: 'pending' as const,
    contact: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: normalizePhone(contact.phone),
      addressLine1: contact.addressLine1,
      city: contact.city,
      state: contact.state,
      postalCode: contact.postalCode,
      countryCode: contact.countryCode.toUpperCase(),
      ...(contact.organization ? { organization: contact.organization } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection('domains').doc(id).set(record);

  // Persist contact details on user profile so the next buy skips re-prompting.
  try {
    await adminDb
      .collection('user_profiles')
      .doc(userId)
      .set(
        {
          phone: normalizePhone(contact.phone),
          shippingAddress: {
            line1: contact.addressLine1,
            city: contact.city,
            state: contact.state,
            postalCode: contact.postalCode,
            countryCode: contact.countryCode.toUpperCase(),
          },
          updatedAt: now,
        },
        { merge: true },
      );
  } catch (err) {
    console.warn('[api:domains.buy] failed to persist contact to user_profiles', err);
  }

  return NextResponse.json({ data: record }, { status: 202 });
}
