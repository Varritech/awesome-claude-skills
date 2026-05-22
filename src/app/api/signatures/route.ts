/**
 * /api/signatures — list & create email signatures.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, parseAndValidate, logRequest } from '@/lib/api/helpers';
import type { SignatureRecord } from '@/lib/signatures/types';

export const dynamic = 'force-dynamic';

const createSignatureSchema = z.object({
  name: z.string().min(1).max(80),
  html: z.string().min(1).max(10000),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('signatures.GET', userId);

  try {
    const snap = await adminDb
      .collection('signatures')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const signatures = snap.docs.map((d) => d.data() as SignatureRecord);
    return NextResponse.json({ data: signatures });
  } catch (err) {
    console.warn('[api:signatures.GET] error', err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, createSignatureSchema);
  if (parsed.response) return parsed.response;
  const { name, html, isDefault } = parsed.data;

  logRequest('signatures.POST', userId, { name });

  const now = new Date().toISOString();
  const id = `sig_${Math.random().toString(36).slice(2, 12)}`;

  if (isDefault) {
    try {
      const existing = await adminDb
        .collection('signatures')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = adminDb.batch();
      existing.docs.forEach((d) => {
        batch.update(d.ref, { isDefault: false, updatedAt: now });
      });
      await batch.commit();
    } catch (err) {
      console.warn('[api:signatures.POST] failed to unset existing defaults', err);
    }
  }

  const record: SignatureRecord = { id, userId, name, html, isDefault, createdAt: now, updatedAt: now };

  try {
    await adminDb.collection('signatures').doc(id).set(record);
  } catch (err) {
    console.warn('[api:signatures.POST] firestore write failed', err);
  }

  return NextResponse.json({ data: record }, { status: 201 });
}
