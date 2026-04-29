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

function mockSeed(userId: string): DomainRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'dom_demo_1',
      userId,
      domain: 'reach.convergeflow.io',
      purpose: 'sending',
      mailforgeDomainId: 'mf_abc123',
      spfStatus: 'green',
      dkimStatus: 'green',
      dmarcStatus: 'yellow',
      mxStatus: 'green',
      overallStatus: 'yellow',
      createdAt: now,
      updatedAt: now,
      verifiedAt: now,
    },
  ];
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

function parseDnsRecords(dnsRecs: MailforgeDnsRecord[], domain: string): MailforgeDomain['dnsRecords'] {
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

  try {
    const snap = await adminDb
      .collection('domains')
      .where('userId', '==', userId)
      .get();
    const domains = snap.docs.map((d) => d.data() as DomainRecord);
    if (domains.length === 0) {
      return NextResponse.json({ data: mockSeed(userId) });
    }
    return NextResponse.json({ data: domains });
  } catch (err) {
    console.warn('[api:domains.GET] falling back to mock seed', err);
    return NextResponse.json({ data: mockSeed(userId) });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, connectDomainSchema);
  if (parsed.response) return parsed.response;
  const { domain, purpose } = parsed.data;

  logRequest('domains.POST', userId, { domain, purpose });

  const now = new Date().toISOString();
  const id = `dom_${Math.random().toString(36).slice(2, 12)}`;

  let mailforgeDomainId: string | undefined;
  let apiDnsRecords: MailforgeDomain['dnsRecords'] | undefined;

  if (mailforge.isConfigured()) {
    try {
      const mfDomain = await mailforge.purchaseDomain(domain);
      mailforgeDomainId = mfDomain.id;

      if (mfDomain.dnsRecords) {
        apiDnsRecords = mfDomain.dnsRecords;
        // If DKIM p= is empty in the immediate response, retry fetching
        const dkimValue = (mfDomain.dnsRecords.dkim as MailforgeDnsRecord | undefined)?.value ?? '';
        if (!dkimValue.replace('v=DKIM1; k=rsa; p=', '').trim()) {
          const retried = await fetchDnsWithRetry(mailforgeDomainId);
          if (retried) apiDnsRecords = parseDnsRecords(retried, domain);
        }
      } else if (mailforgeDomainId) {
        const dnsRecs = await fetchDnsWithRetry(mailforgeDomainId);
        if (dnsRecs) apiDnsRecords = parseDnsRecords(dnsRecs, domain);
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

  try {
    await adminDb.collection('domains').doc(id).set(record);
  } catch (err) {
    console.warn('[api:domains.POST] placeholder mode', err);
  }

  return NextResponse.json(
    { data: { ...record, instructions } },
    { status: 201 },
  );
}