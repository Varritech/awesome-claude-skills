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
import type { MailforgeDomain } from '@/lib/mailforge/client';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchDnsWithRetry(
  domainId: string,
  maxAttempts = 6,
  delayMs = 3000,
): Promise<mailforge.MailforgeDnsRecord[]> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const recs = await mailforge.getDomainDns(domainId);
    const dkim = recs.find((r) => r.host?.includes('domainkey'));
    const dkimKey = dkim?.value?.replace('v=DKIM1; k=rsa; p=', '').trim();
    if (dkimKey && dkimKey.length > 0) {
      return recs;
    }
    if (attempt < maxAttempts) await sleep(delayMs);
  }
  return mailforge.getDomainDns(domainId);
}

function parseDnsRecords(recs: mailforge.MailforgeDnsRecord[]): MailforgeDomain['dnsRecords'] {
  return {
    spf: recs.find((r) => r.type?.toUpperCase() === 'TXT' && r.value?.includes('spf')),
    dkim: recs.find((r) => r.host?.includes('domainkey')),
    dmarc: recs.find((r) => r.host?.startsWith('_dmarc')),
    mx: recs.find((r) => r.type?.toUpperCase() === 'MX'),
  };
}

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

  // Attempt to register domain with Mailforge API.
  // Falls back gracefully when MAILFORGE_API_KEY is not set.
  let mailforgeDomainId: string | undefined;
  let apiDnsRecords: MailforgeDomain['dnsRecords'] | undefined;

  if (mailforge.isConfigured()) {
    try {
      const mfDomain = await mailforge.purchaseDomain(domain);
      mailforgeDomainId = mfDomain.id;

      // DKIM is provisioned asynchronously by Mailforge — retry until p= is populated
      const dnsRecs = await fetchDnsWithRetry(mailforgeDomainId);
      apiDnsRecords = parseDnsRecords(dnsRecs);
    } catch (err) {
      console.warn('[api:domains.POST] mailforge.purchaseDomain failed', err);
    }
  }

  // DNS instructions: use Mailforge API values when available.
  // SPF/DMARC/MX have known standard values as fallbacks; DKIM has NO fallback
  // since an empty p= value is useless and misleading.
  const instructions = {
    spf: apiDnsRecords?.spf ?? {
      host: domain,
      type: 'TXT',
      value: 'v=spf1 include:_spf.mailforge.com ~all',
    },
    dkim: apiDnsRecords?.dkim ?? {
      host: `cf._domainkey.${domain}`,
      type: 'TXT',
      value: '',
    },
    dmarc: apiDnsRecords?.dmarc ?? {
      host: `_dmarc.${domain}`,
      type: 'TXT',
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io',
    },
    mx: apiDnsRecords?.mx ?? {
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
