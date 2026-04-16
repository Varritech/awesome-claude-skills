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

export const dynamic = 'force-dynamic';

type DnsStatus = 'pending' | 'red' | 'yellow' | 'green';

interface DomainRecord {
  id: string;
  userId: string;
  domain: string;
  purpose: 'primary' | 'sending';
  mailforgeProjectId?: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  mxStatus: DnsStatus;
  overallStatus: DnsStatus;
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
      mailforgeProjectId: 'mf_abc123',
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

  // TODO: Call Mailforge API to provision DNS records:
  //   POST https://api.mailforge.com/v1/domains
  //   body: { domain, redirectTo: 'convergeflow.io' }
  //   Response gives us the SPF/DKIM/DMARC records the user must add.
  const now = new Date().toISOString();
  const id = `dom_${Math.random().toString(36).slice(2, 12)}`;

  const record: DomainRecord = {
    id,
    userId,
    domain,
    purpose,
    mailforgeProjectId: `mf_placeholder_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    spfStatus: 'pending',
    dkimStatus: 'pending',
    dmarcStatus: 'pending',
    mxStatus: 'pending',
    overallStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    verifiedAt: null,
  };

  const instructions = {
    spf: {
      host: domain,
      type: 'TXT',
      value: 'v=spf1 include:_spf.mailforge.com ~all',
    },
    dkim: {
      host: `cf._domainkey.${domain}`,
      type: 'TXT',
      value: 'v=DKIM1; k=rsa; p=PLACEHOLDER_PUBLIC_KEY_HERE',
    },
    dmarc: {
      host: `_dmarc.${domain}`,
      type: 'TXT',
      value: 'v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io',
    },
    mx: {
      host: domain,
      type: 'MX',
      value: '10 mx.mailforge.com',
    },
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
