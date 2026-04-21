/**
 * /api/domains/[id]/verify - re-check DNS records for a domain.
 *
 * TODO: Wire to real DNS lookup. Recommended approach:
 *   - Call Mailforge `GET /v1/domains/{id}/status` OR
 *   - Use `node:dns.promises.resolveTxt()` / `resolveMx()` directly and
 *     compare against the expected values stored on the domain doc.
 *
 * The placeholder implementation returns mock red/yellow/green statuses
 * that the UI can use to build the domain health page.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

interface RouteCtx {
  params: { id: string };
}

type DnsStatus = 'red' | 'yellow' | 'green';

const STATUS_CYCLE: DnsStatus[] = ['green', 'yellow', 'red'];

function pseudoStatus(seed: string, offset: number): DnsStatus {
  // Deterministic pseudo-random so repeated calls give a stable preview.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return STATUS_CYCLE[Math.abs(hash + offset) % STATUS_CYCLE.length]!;
}

function overall(statuses: DnsStatus[]): DnsStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;
  const { id } = ctx.params;

  logRequest('domains.[id].verify.POST', userId, { id });

  const spf = pseudoStatus(id, 0);
  const dkim = pseudoStatus(id, 1);
  const dmarc = pseudoStatus(id, 2);
  const mx = pseudoStatus(id, 3);
  const overallStatus = overall([spf, dkim, dmarc, mx]);

  const result = {
    id,
    spfStatus: spf,
    dkimStatus: dkim,
    dmarcStatus: dmarc,
    mxStatus: mx,
    overallStatus,
    verifiedAt: new Date().toISOString(),
    checks: [
      { record: 'SPF', status: spf, host: 'placeholder' },
      { record: 'DKIM', status: dkim, host: 'cf._domainkey.placeholder' },
      { record: 'DMARC', status: dmarc, host: '_dmarc.placeholder' },
      { record: 'MX', status: mx, host: 'placeholder' },
    ],
  };

  try {
    await adminDb
      .collection('domains')
      .doc(id)
      .set(
        {
          spfStatus: spf,
          dkimStatus: dkim,
          dmarcStatus: dmarc,
          mxStatus: mx,
          overallStatus,
          verifiedAt: result.verifiedAt,
          updatedAt: result.verifiedAt,
        },
        { merge: true },
      );
  } catch (err) {
    console.warn('[api:domains.[id].verify] placeholder mode', err);
  }

  return NextResponse.json({ data: result });
}
