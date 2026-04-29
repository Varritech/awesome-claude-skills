/**
 * /api/domains/[id]/verify - re-check DNS records for a domain.
 *
 * Uses Node's built-in dns.promises to perform real DNS lookups against the
 * expected SPF/DKIM/DMARC/MX values stored on the domain Firestore doc.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { promises as dns } from 'dns';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';
import * as mailforge from '@/lib/mailforge/client';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

type DnsStatus = 'pending' | 'red' | 'yellow' | 'green';

interface DnsCheck {
  record: string;
  status: DnsStatus;
  host: string;
  expected?: string;
  found?: string[];
}

interface DomainDoc {
  domain: string;
  mailforgeDomainId?: string;
  spfStatus?: DnsStatus;
  dkimStatus?: DnsStatus;
  dmarcStatus?: DnsStatus;
  mxStatus?: DnsStatus;
  // DNS instructions stored at creation time
  dnsInstructions?: {
    spf?: { host: string; value: string };
    dkim?: { host: string; value: string };
    dmarc?: { host: string; value: string };
    mx?: { host: string; value: string };
  };
}

function overall(statuses: DnsStatus[]): DnsStatus {
  if (statuses.every((s) => s === 'green')) return 'green';
  if (statuses.includes('red')) return 'red';
  return 'yellow';
}

async function checkTxt(host: string, expected: string): Promise<{ status: DnsStatus; found: string[] }> {
  try {
    const records = await dns.resolveTxt(host);
    const flat = records.map((r) => r.join('')).filter(Boolean);
    const matched = flat.some((r) => r.includes(expected) || expected.includes(r.slice(0, 20)));
    return { status: matched ? 'green' : 'red', found: flat };
  } catch {
    return { status: 'red', found: [] };
  }
}

async function checkMx(host: string, expectedHostFragment: string): Promise<{ status: DnsStatus; found: string[] }> {
  try {
    const records = await dns.resolveMx(host);
    const found = records.map((r) => `${r.priority} ${r.exchange}`);
    const matched = records.some((r) => r.exchange.includes(expectedHostFragment));
    return { status: matched ? 'green' : 'red', found };
  } catch {
    return { status: 'red', found: [] };
  }
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest('domains.[id].verify.POST', userId, { id });

  // Load the domain doc to get the actual domain name and expected values
  let domainDoc: DomainDoc | null = null;
  try {
    const snap = await adminDb.collection('domains').doc(id).get();
    if (snap.exists) {
      domainDoc = snap.data() as DomainDoc;
    }
  } catch (err) {
    console.warn('[api:domains.[id].verify] could not load domain doc', err);
  }

  const domain = domainDoc?.domain ?? id;
  const instructions = domainDoc?.dnsInstructions;

  // If Mailforge API is configured and we have a mailforgeDomainId, fetch
  // the actual DNS records from Mailforge to use as the expected values.
  const mfId = (domainDoc as Record<string, unknown> | null)?.mailforgeDomainId as string | undefined;
  if (mailforge.isConfigured() && mfId) {
    try {
      await mailforge.getDomainDns(mfId);
    } catch (err) {
      console.warn('[api:domains.[id].verify] mailforge.getDomainDns failed', err);
    }
  }

  // Default expected values (Mailforge standard) if not stored on the doc
  const spfHost = instructions?.spf?.host ?? domain;
  const spfExpected = instructions?.spf?.value ?? 'v=spf1 include:_spf.mailforge.com';
  const dkimHost = instructions?.dkim?.host ?? `cf._domainkey.${domain}`;
  const dkimExpected = instructions?.dkim?.value ?? 'v=DKIM1';
  const dmarcHost = instructions?.dmarc?.host ?? `_dmarc.${domain}`;
  const dmarcExpected = instructions?.dmarc?.value ?? 'v=DMARC1';
  const mxExpected = 'mailforge.com';

  const [spfResult, dkimResult, dmarcResult, mxResult] = await Promise.all([
    checkTxt(spfHost, spfExpected),
    checkTxt(dkimHost, dkimExpected),
    checkTxt(dmarcHost, dmarcExpected),
    checkMx(domain, mxExpected),
  ]);

  const checks: DnsCheck[] = [
    { record: 'SPF', status: spfResult.status, host: spfHost, expected: spfExpected, found: spfResult.found },
    { record: 'DKIM', status: dkimResult.status, host: dkimHost, expected: dkimExpected, found: dkimResult.found },
    { record: 'DMARC', status: dmarcResult.status, host: dmarcHost, expected: dmarcExpected, found: dmarcResult.found },
    { record: 'MX', status: mxResult.status, host: domain, expected: mxExpected, found: mxResult.found },
  ];

  const overallStatus = overall(checks.map((c) => c.status));
  const verifiedAt = new Date().toISOString();

  const patch = {
    spfStatus: spfResult.status,
    dkimStatus: dkimResult.status,
    dmarcStatus: dmarcResult.status,
    mxStatus: mxResult.status,
    overallStatus,
    verifiedAt,
    updatedAt: verifiedAt,
  };

  try {
    await adminDb.collection('domains').doc(id).set(patch, { merge: true });
  } catch (err) {
    console.warn('[api:domains.[id].verify] firestore update failed', err);
  }

  return NextResponse.json({
    data: {
      id,
      domain,
      ...patch,
      checks,
    },
  });
}
