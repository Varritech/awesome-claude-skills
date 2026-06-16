/**
 * /api/domains/[id]/verify - re-check DNS records for a domain.
 *
 * Uses Node's built-in dns.promises to perform real DNS lookups against the
 * expected SPF/DKIM/DMARC/MX values stored on the domain Firestore doc.
 * For Resend-managed domains we also poll Resend's `/domains/{id}/verify`
 * endpoint so the dashboard status mirrors what Resend itself sees.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { promises as dns } from 'dns';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';
import * as resend from '@/lib/resend/client';

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
  resendDomainId?: string;
  /** Legacy field kept so docs created before the Resend migration still load. */
  mailforgeDomainId?: string;
  spfStatus?: DnsStatus;
  dkimStatus?: DnsStatus;
  dmarcStatus?: DnsStatus;
  mxStatus?: DnsStatus;
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

/**
 * Extract a meaningful match signature from an expected TXT record value so
 * we can detect the right record on the host without requiring byte-for-byte
 * equality. Each protocol has a specific token that must be present:
 *
 *   SPF   → `include:<sender>` (e.g. `include:_spf.mailforge.com`)
 *   DKIM  → the full `p=<key>` payload after the prefix (non-empty)
 *   DMARC → `v=DMARC1` plus `p=` policy
 *
 * Falling back to substring of the raw expected value silently passes any
 * record that shares a generic prefix (e.g. Google SPF passing the Mailforge
 * SPF check). The previous implementation did exactly that.
 */
function extractMatchSignature(record: 'spf' | 'dkim' | 'dmarc', expected: string): string | null {
  if (record === 'spf') {
    const m = expected.match(/include:[^\s"]+/);
    return m ? m[0] : null;
  }
  if (record === 'dkim') {
    const m = expected.match(/p=([A-Za-z0-9+/=]{16,})/);
    return m ? `p=${m[1]}` : null;
  }
  if (record === 'dmarc') {
    return 'v=DMARC1';
  }
  return null;
}

async function checkTxt(
  host: string,
  expected: string,
  record: 'spf' | 'dkim' | 'dmarc',
): Promise<{ status: DnsStatus; found: string[] }> {
  try {
    const records = await dns.resolveTxt(host);
    const flat = records.map((r) => r.join('')).filter(Boolean);

    // For DKIM, a placeholder expected value (`v=DKIM1; k=rsa; p=` with no key)
    // means we don't know the real public key yet — treat as red, never green.
    if (record === 'dkim') {
      const sig = extractMatchSignature('dkim', expected);
      if (!sig) return { status: 'red', found: flat };
      // Require the published record to also contain a non-trivial `p=<key>`
      const matched = flat.some((r) => {
        const m = r.match(/p=([A-Za-z0-9+/=]{16,})/);
        if (!m) return false;
        return r.includes(sig) || sig.includes(`p=${m[1]}`);
      });
      return { status: matched ? 'green' : 'red', found: flat };
    }

    const sig = extractMatchSignature(record, expected);
    if (!sig) {
      // No reliable signature → fall back to exact substring match only
      const matched = flat.some((r) => r.includes(expected));
      return { status: matched ? 'green' : 'red', found: flat };
    }

    const matched = flat.some((r) => r.includes(sig));
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
  let instructions = domainDoc?.dnsInstructions;
  const resendId = domainDoc?.resendDomainId;

  // Ask Resend to recheck the domain so the records list (and DKIM key) is
  // up to date on its side. Best-effort: if Resend is down we still fall
  // back to our own Node DNS lookups below.
  if (resend.isConfigured() && resendId) {
    try {
      const refreshed = await resend.verifyDomain(resendId);
      const records = refreshed.records ?? [];
      const spf = records.find((r) => r.record === 'SPF');
      const dkim = records.find((r) => r.record === 'DKIM');
      const mx = records.find((r) => r.record === 'MX');
      const dmarc = records.find((r) => r.name.startsWith('_dmarc'));

      if (spf || dkim || mx || dmarc) {
        const next = {
          spf: spf ? { host: spf.name, type: spf.type, value: spf.value } : instructions?.spf,
          dkim: dkim ? { host: dkim.name, type: dkim.type, value: dkim.value } : instructions?.dkim,
          dmarc: dmarc ? { host: dmarc.name, type: dmarc.type, value: dmarc.value } : instructions?.dmarc,
          mx: mx ? { host: mx.name, type: mx.type, value: mx.value } : instructions?.mx,
        };
        try {
          await adminDb
            .collection('domains')
            .doc(id)
            .set({ dnsInstructions: next, updatedAt: new Date().toISOString() }, { merge: true });
          instructions = next as typeof instructions;
        } catch (err) {
          console.warn('[api:domains.[id].verify] failed to persist refreshed instructions', err);
        }
      }
    } catch (err) {
      console.warn('[api:domains.[id].verify] resend.verifyDomain failed', err);
    }
  }

  const spfHost = instructions?.spf?.host ?? domain;
  const spfExpected = instructions?.spf?.value ?? 'v=spf1 include:_resend.com';
  const dkimHost = instructions?.dkim?.host ?? `resend._domainkey.${domain}`;
  const dkimExpected = instructions?.dkim?.value ?? 'v=DKIM1';
  const dmarcHost = instructions?.dmarc?.host ?? `_dmarc.${domain}`;
  const dmarcExpected = instructions?.dmarc?.value ?? 'v=DMARC1';
  const mxExpected = 'resend.com';

  const [spfResult, dkimResult, dmarcResult, mxResult] = await Promise.all([
    checkTxt(spfHost, spfExpected, 'spf'),
    checkTxt(dkimHost, dkimExpected, 'dkim'),
    checkTxt(dmarcHost, dmarcExpected, 'dmarc'),
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
      // Return refreshed instructions so the UI can update displayed DNS records
      dnsInstructions: instructions,
    },
  });
}