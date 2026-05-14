/**
 * POST /api/auth/verify-code
 * Validates a 6-digit OTP against the stored record in Firestore.
 * On success, sets Clerk publicMetadata.emailVerified = true.
 */

import { timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import {
  requireUser,
  parseAndValidate,
  logRequest,
  jsonError,
} from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

const verifyCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Must be a 6-digit numeric code'),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, verifyCodeSchema);
  if (parsed.response) return parsed.response;
  const { code } = parsed.data;

  logRequest('auth.verify-code.POST', userId);

  let record: { otp: string; expiresAt: string; verified: boolean } | null = null;

  try {
    const snap = await adminDb.collection('emailVerifications').doc(userId).get();
    if (snap.exists) {
      record = snap.data() as { otp: string; expiresAt: string; verified: boolean };
    }
  } catch (err) {
    console.warn('[api:auth.verify-code] firestore read failed', err);
  }

  if (!record) {
    return jsonError('No verification code found. Request a new one.', 400);
  }

  if (new Date(record.expiresAt) < new Date()) {
    return jsonError('Verification code has expired. Request a new one.', 400);
  }

  const a = Buffer.from(record.otp.padEnd(10));
  const b = Buffer.from(code.padEnd(10));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return jsonError('Invalid verification code.', 400);
  }

  // Mark as verified in Firestore
  try {
    await adminDb
      .collection('emailVerifications')
      .doc(userId)
      .set({ verified: true }, { merge: true });
  } catch (err) {
    console.warn('[api:auth.verify-code] firestore update failed', err);
  }

  // Update Clerk publicMetadata
  try {
    await adminAuth.setCustomUserClaims(userId, { emailVerified: true });
    await adminDb.collection('users').doc(userId).set(
      { emailVerified: true, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.warn('[api:auth.verify-code] clerk metadata update failed', err);
  }

  return NextResponse.json({ data: { verified: true } });
}
