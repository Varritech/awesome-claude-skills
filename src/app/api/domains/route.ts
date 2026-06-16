/**
 * /api/domains - list & connect sending domains (Resend integration).
 *
 * BYO flow: the customer enters a domain they already own, Resend issues
 * DKIM/SPF/DMARC records, the customer adds them to their own DNS, our
 * verify endpoint polls until all green.
 *
 * Customer-purchase ("buy fresh") flow is handled in a separate endpoint
 * (POST /api/domains/buy) and uses GCP Cloud Domains.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, parseAndValidate, requireUser } from '@/lib/api/helpers';
import { connectDomainSchema } from '@/lib/schemas';
import * as resend from '@/lib/resend/client';
import type { ResendDomain, ResendDnsRecord } from '@/lib/resend/client';

export const dynamic = 'force-dynamic';

type DnsStatus = 'pending' | 'red' | 'yellow' | 'green';

interface DnsInstruction {
  host: string;
  type: string;
  value: string;
  priority?: number;
}

interface DomainRecord {
  id: string;
  userId: string;
  domain: string;
  purpose: 'primary' | 'sending';
  provider: 'resend';
  resendDomainId?: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  mxStatus: DnsStatus;
  overallStatus: DnsStatus;
  dnsInstructions?: {
    spf: DnsInstruction;
    dkim: DnsInstruction;
    dmarc: DnsInstruction;
    mx?: DnsInstruction;
  };
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
}

/**
 * Map Resend's DNS record list into our internal instruction shape. Resend
 * returns SPF/DKIM/DMARC records flagged by the `record` field. We index by
 * that flag so the UI can render each section without guessing.
 */
function instructionsFromResend(records: ResendDnsRecord[]): DomainRecord['dnsInstructions'] {
  const find = (kind: ResendDnsRecord['record']) => records.find((r) => r.record === kind);
  const spf = find('SPF');
  const dkim = find('DKIM');
  // DMARC isn't always returned by Resend on the initial create, so we
  // synthesize a default `p=none` policy. Customers can tighten later.
  const dmarcFromResend = records.find((r) => r.name.startsWith('_dmarc'));
  const mx = find('MX');

  return {
    spf: spf
      ? { host: spf.name, type: spf.type, value: spf.value }
      : { host: '@', type: 'TXT', value: 'v=spf1 include:_resend.com ~all' },
    dkim: dkim
      ? { host: dkim.name, type: dkim.type, value: dkim.value }
      : { host: 'resend._domainkey', type: 'TXT', value: '' },
    dmarc: dmarcFromResend
      ? { host: dmarcFromResend.name, type: dmarcFromResend.type, value: dmarcFromResend.value }
      : {
          host: '_dmarc',
          type: 'TXT',
          value: 'v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io',
        },
    ...(mx
      ? {
          mx: {
            host: mx.name,
            type: mx.type,
            value: mx.value,
            priority: mx.priority,
          },
        }
      : {}),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('domains.GET', userId);

  const snap = await adminDb.collection('domains').where('userId', '==', userId).get();
  const domains = snap.docs.map((d) => d.data() as DomainRecord);
  return NextResponse.json({ data: domains });
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

  if (!resend.isConfigured()) {
    return NextResponse.json(
      {
        error: 'provider_unavailable',
        message:
          'The email sending provider is not configured. Set RESEND_API_KEY in the deployment environment.',
      },
      { status: 503 },
    );
  }

  let resendDomain: ResendDomain | null = null;
  try {
    resendDomain = await resend.createDomain(domain);
  } catch (err) {
    console.error('[api:domains.POST] resend.createDomain failed', err);
    return NextResponse.json(
      {
        error: 'provider_error',
        message:
          'Could not register the domain with the sending provider. The most common cause is a duplicate domain or an invalid format.',
      },
      { status: 502 },
    );
  }

  const instructions = instructionsFromResend(resendDomain.records ?? []);

  const record: DomainRecord = {
    id,
    userId,
    domain,
    purpose,
    provider: 'resend',
    resendDomainId: resendDomain.id,
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

  return NextResponse.json({ data: { ...record, instructions } }, { status: 201 });
}
