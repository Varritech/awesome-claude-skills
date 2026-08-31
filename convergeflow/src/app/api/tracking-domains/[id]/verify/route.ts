/**
 * POST /api/tracking-domains/[id]/verify
 *
 * Performs a DNS CNAME lookup to verify that the tracking domain
 * is correctly pointed at the ConvergeFlow tracking infrastructure.
 *
 * Updates the trackingDomain document's `verified` field.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, logRequest, jsonError } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';
import dns from 'dns/promises';

export const dynamic = 'force-dynamic';

const EXPECTED_CNAME_TARGET = 'track.convergeflow.io';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const { id } = params;
  logRequest('trackingDomains.verify.POST', userId, { id });

  const docRef = adminDb.collection('trackingDomains').doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    return jsonError('Tracking domain not found', 404);
  }

  const record = snap.data()!;
  if (record.userId !== userId) {
    return jsonError('Forbidden', 403);
  }

  const domain = record.domain as string;

  let verified = false;
  let resolvedCname: string | null = null;
  let error: string | null = null;

  try {
    const addresses = await dns.resolveCname(domain);
    resolvedCname = addresses[0] ?? null;
    // Strip trailing dot for comparison
    const normalized = resolvedCname?.replace(/\.$/, '') ?? '';
    verified = normalized === EXPECTED_CNAME_TARGET;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  }

  await docRef.set(
    {
      verified,
      lastCheckedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({
    data: {
      id,
      domain,
      verified,
      resolvedCname,
      expectedCname: EXPECTED_CNAME_TARGET,
      ...(error ? { error } : {}),
    },
  });
}
