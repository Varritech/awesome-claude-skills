/**
 * /api/domains - list & connect sending domains (Mailforge integration).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { connectDomainSchema } from '@/lib/schemas';
import * as mailforge from '@/lib/mailforge/client';
import type { MailforgeDomain, MailforgeDnsRecord } from '@/lib/mailforge/client';
import { normalizePhone } from '@/lib/schemas/domain';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

type DnsStatus = 'pending' | 'red' | 'yellow' | 'green';

interface DnsInstruction {
  host: string;
  type: string;
  value: string;
}

interface DomainRecord {
  id: string;
  userId: string;
  domain: string;
  purpose: 'primary' | 'sending';
  mailforgeDomainId?: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  mxStatus: DnsStatus;
  overallStatus: DnsStatus;
  dnsInstructions?: {
    spf: DnsInstruction;
    dkim: DnsInstruction;
    dmarc: DnsInstruction;
    mx: DnsInstruction;
  };
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch DNS records from Mailforge, retrying up to maxAttempts times to wait
 *  for async DKIM key generation. Returns null if all attempts fail. */
async function fetchDnsWithRetry(
  domainId: string,
  maxAttempts = 4,
  delayMs = 2500,
): Promise<MailforgeDnsRecord[] | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const recs = await mailforge.getDomainDns(domainId);
      const dkim = recs.find((r) => r.host?.includes('domainkey'));
      // Consider the key ready when p= has a value beyond the prefix
      if (dkim?.value && dkim.value.replace('v=DKIM1; k=rsa; p=', '').trim().length > 0) {
        return recs;
      }
      if (attempt < maxAttempts) {
        console.info(`[api:domains.POST] DKIM not ready yet (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms`);
        await sleep(delayMs);
      }
    } catch (err) {
      console.warn(`[api:domains.POST] getDomainDns attempt ${attempt} failed`, err);
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  // Return whatever we got on the last attempt even if DKIM isn't ready
  try {
    return await mailforge.getDomainDns(domainId);
  } catch {
    return null;
  }
}

function parseDnsRecords(dnsRecs: MailforgeDnsRecord[]): MailforgeDomain['dnsRecords'] {
  const find = (predicate: (r: MailforgeDnsRecord) => boolean) => dnsRecs.find(predicate);
  return {
    spf: find((r) => r.type?.toUpperCase() === 'TXT' && r.value?.includes('spf')),
    dkim: find((r) => r.host?.includes('domainkey')),
    dmarc: find((r) => r.host?.startsWith('_dmarc')),
    mx: find((r) => r.type?.toUpperCase() === 'MX'),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('domains.GET', userId);

  const snap = await adminDb
    .collection('domains')
    .where('userId', '==', userId)
    .get();
  const domains = snap.docs.map((d) => d.data() as DomainRecord);
  return NextResponse.json({ data: domains });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, connectDomainSchema);
  if (parsed.response) return parsed.response;
  const { domain, purpose, phone: phoneFromRequest } = parsed.data;

  logRequest('domains.POST', userId, { domain, purpose });

  // ─── Resolve WHOIS contact for Mailforge ───────────────────────────────────
  // Mailforge requires phone (ICANN WHOIS rule). Try the request body first,
  // then fall back to the caller's stored profile phone, then Clerk's primary
  // phone number. If still missing, 422 so the UI can prompt the user.
  let resolvedPhone = phoneFromRequest;
  let registrantFirstName: string | undefined;
  let registrantLastName: string | undefined;
  let registrantEmail: string | undefined;

  try {
    const profileSnap = await adminDb.collection('user_profiles').doc(userId).get();
    if (profileSnap.exists) {
      const data = profileSnap.data() as { phone?: string };
      if (!resolvedPhone && data.phone) resolvedPhone = data.phone;
    }
  } catch (err) {
    console.warn('[api:domains.POST] could not load user profile', err);
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    if (!resolvedPhone) {
      const primary = clerkUser.phoneNumbers.find(
        (p) => p.id === clerkUser.primaryPhoneNumberId,
      );
      if (primary?.phoneNumber) resolvedPhone = primary.phoneNumber;
    }
    registrantFirstName = clerkUser.firstName ?? undefined;
    registrantLastName = clerkUser.lastName ?? undefined;
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    registrantEmail = primaryEmail?.emailAddress;
  } catch (err) {
    console.warn('[api:domains.POST] could not load Clerk user', err);
  }

  if (!resolvedPhone) {
    return NextResponse.json(
      {
        error: 'phone_required',
        message:
          'A phone number is required to register the domain (ICANN WHOIS). Please add a phone number to your profile and try again.',
      },
      { status: 422 },
    );
  }

  // Persist the phone back to the user profile so the next domain registration
  // (and any retry) doesn't need to re-prompt. Best-effort; failure is logged
  // but does not block the registration flow.
  if (phoneFromRequest) {
    try {
      await adminDb
        .collection('user_profiles')
        .doc(userId)
        .set({ phone: resolvedPhone, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn('[api:domains.POST] failed to persist phone to user_profiles', err);
    }
  }

  const now = new Date().toISOString();
  const id = `dom_${Math.random().toString(36).slice(2, 12)}`;

  let mailforgeDomainId: string | undefined;
  let apiDnsRecords: MailforgeDomain['dnsRecords'] | undefined;

  if (mailforge.isConfigured()) {
    try {
      const mfDomain = await mailforge.purchaseDomain(domain, {
        phone: normalizePhone(resolvedPhone),
        email: registrantEmail,
        firstName: registrantFirstName,
        lastName: registrantLastName,
      });
      mailforgeDomainId = mfDomain.id;

      if (mfDomain.dnsRecords) {
        apiDnsRecords = mfDomain.dnsRecords;
        // If DKIM p= is empty in the immediate response, retry fetching
        const dkimValue = (mfDomain.dnsRecords.dkim as MailforgeDnsRecord | undefined)?.value ?? '';
        if (!dkimValue.replace('v=DKIM1; k=rsa; p=', '').trim()) {
          const retried = await fetchDnsWithRetry(mailforgeDomainId);
          if (retried) apiDnsRecords = parseDnsRecords(retried);
        }
      } else if (mailforgeDomainId) {
        const dnsRecs = await fetchDnsWithRetry(mailforgeDomainId);
        if (dnsRecs) apiDnsRecords = parseDnsRecords(dnsRecs);
      }
    } catch (err) {
      console.warn('[api:domains.POST] mailforge.purchaseDomain failed', err);
    }
  }

  const instructions = {
    spf: (apiDnsRecords?.spf as MailforgeDnsRecord | undefined) ?? {
      host: domain,
      type: 'TXT',
      value: 'v=spf1 include:_spf.mailforge.com ~all',
    },
    dkim: (apiDnsRecords?.dkim as MailforgeDnsRecord | undefined) ?? {
      host: `cf._domainkey.${domain}`,
      type: 'TXT',
      value: 'v=DKIM1; k=rsa; p=',
    },
    dmarc: (apiDnsRecords?.dmarc as MailforgeDnsRecord | undefined) ?? {
      host: `_dmarc.${domain}`,
      type: 'TXT',
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io',
    },
    mx: (apiDnsRecords?.mx as MailforgeDnsRecord | undefined) ?? {
      host: domain,
      type: 'MX',
      value: '10 mx.mailforge.com',
    },
  };

  const record: DomainRecord = {
    id,
    userId,
    domain,
    purpose,
    ...(mailforgeDomainId ? { mailforgeDomainId } : {}),
    spfStatus: 'pending',
    dkimStatus: 'pending',
    dmarcStatus: 'pending',
    mxStatus: 'pending',
    overallStatus: 'pending',
    dnsInstructions: instructions,
    createdAt: now,
    updatedAt: now,
    verifiedAt: null,
  };

  await adminDb.collection('domains').doc(id).set(record);

  return NextResponse.json(
    { data: { ...record, instructions } },
    { status: 201 },
  );
}