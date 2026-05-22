/**
 * /api/signatures/[id] — get, update, delete a single signature.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import {
  requireUser,
  parseAndValidate,
  logRequest,
  jsonError,
  handleError,
} from '@/lib/api/helpers';
import { assertOwnership } from '@/lib/security/data-isolation';
import type { SignatureRecord } from '@/lib/signatures/types';

export const dynamic = 'force-dynamic';

const updateSignatureSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  html: z.string().min(1).max(10000).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('signatures.[id].GET', userId);

  try {
    const snap = await adminDb.collection('signatures').doc(params.id).get();
    if (!snap.exists) return jsonError('Signature not found', 404);
    const record = snap.data() as SignatureRecord;
    assertOwnership(userId, record, 'signature');
    return NextResponse.json({ data: record });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateSignatureSchema);
  if (parsed.response) return parsed.response;

  logRequest('signatures.[id].PUT', userId);

  try {
    const snap = await adminDb.collection('signatures').doc(params.id).get();
    if (!snap.exists) return jsonError('Signature not found', 404);
    const record = snap.data() as SignatureRecord;
    assertOwnership(userId, record, 'signature');

    const now = new Date().toISOString();

    if (parsed.data.isDefault) {
      const existing = await adminDb
        .collection('signatures')
        .where('userId', '==', userId)
        .where('isDefault', '==', true)
        .get();
      const batch = adminDb.batch();
      existing.docs.forEach((d) => {
        if (d.id !== params.id) batch.update(d.ref, { isDefault: false, updatedAt: now });
      });
      await batch.commit();
    }

    const update = { ...parsed.data, updatedAt: now };
    await adminDb.collection('signatures').doc(params.id).set(update, { merge: true });

    const updated = { ...record, ...update };
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('signatures.[id].DELETE', userId);

  try {
    const snap = await adminDb.collection('signatures').doc(params.id).get();
    if (!snap.exists) return jsonError('Signature not found', 404);
    const record = snap.data() as SignatureRecord;
    assertOwnership(userId, record, 'signature');
    await adminDb.collection('signatures').doc(params.id).delete();
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleError(err);
  }
}
