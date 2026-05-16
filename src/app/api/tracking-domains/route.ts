/**
 * GET  /api/tracking-domains  - list user's tracking domains
 * POST /api/tracking-domains  - add a new tracking domain
 *
 * Firestore collection: trackingDomains
 * { id, userId, domain, verified: boolean, cnameTarget, createdAt }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, parseAndValidate, logRequest } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const CNAME_TARGET = 'track.convergeflow.io';

const createTrackingDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/, 'Invalid domain format'),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('trackingDomains.GET', userId);

  const snap = await adminDb
    .collection('trackingDomains')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  const domains = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ data: { domains } });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('trackingDomains.POST', userId);

  const parsed = await parseAndValidate(req, createTrackingDomainSchema);
  if (parsed.response) return parsed.response;
  const { domain } = parsed.data;

  const now = new Date().toISOString();
  const docRef = adminDb.collection('trackingDomains').doc();
  const record = {
    id: docRef.id,
    userId,
    domain,
    verified: false,
    cnameTarget: CNAME_TARGET,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(record);

  return NextResponse.json({ data: record }, { status: 201 });
}
