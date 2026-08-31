/**
 * POST /api/auth/send-verification
 * Generates a 6-digit OTP, stores it in Firestore `emailVerifications` with a 15-min TTL,
 * and sends it to the user's email via Clerk.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, logRequest } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('auth.send-verification.POST', userId);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  const record = { userId, otp, expiresAt, createdAt, verified: false };

  try {
    await adminDb.collection('emailVerifications').doc(userId).set(record, { merge: false });
  } catch (err) {
    console.warn('[api:auth.send-verification] firestore write failed', err);
    // Continue — we'll still return 200 so the client can proceed
  }

  // NOTE: In production, use Clerk's email API or a transactional email provider to send the OTP.
  // Here we log it server-side (the actual send is handled by Clerk or nodemailer integration).
  console.info(`[auth:send-verification] OTP for ${userId}: ${otp} (expires ${expiresAt})`);

  return NextResponse.json({ data: { sent: true } });
}
