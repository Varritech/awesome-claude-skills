/**
 * POST /api/user/onboarding/skip
 * Sets onboardingSkipped = true in Clerk publicMetadata and Firestore.
 */

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { requireUser, logRequest } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('user.onboarding.skip.POST', userId);

  const patch = {
    userId,
    onboardingSkipped: true,
    updatedAt: new Date().toISOString(),
  };

  try {
    await adminDb.collection('onboarding').doc(userId).set(patch, { merge: true });
  } catch (err) {
    console.warn('[api:user.onboarding.skip] firestore write failed', err);
  }

  try {
    await adminAuth.setCustomUserClaims(userId, { onboardingSkipped: true });
  } catch (err) {
    console.warn('[api:user.onboarding.skip] clerk metadata update failed', err);
  }

  return NextResponse.json({ data: { onboardingSkipped: true } });
}
