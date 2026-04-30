/**
 * /api/user/profile - get & update current user's profile.
 *
 * The canonical identity is Clerk. This route reads/writes the mirrored
 * profile doc at Firestore `users/{clerkUserId}`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { updateProfileSchema } from '@/lib/schemas';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

interface UserProfileRecord {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  tier: 'self_serve' | 'openclaw_dwy' | 'enterprise';
  company?: string;
  website?: string;
  industry?: string;
  role?: string;
  timezone?: string;
  onboardingStep:
    | 'profile'
    | 'domain'
    | 'inbox'
    | 'leads'
    | 'persona'
    | 'first_campaign'
    | 'complete';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

function mockProfile(userId: string): UserProfileRecord {
  const now = new Date().toISOString();
  return {
    id: userId,
    email: 'you@example.com',
    firstName: 'Chris',
    lastName: 'Varriale',
    tier: 'self_serve',
    company: 'Varritech',
    timezone: 'America/New_York',
    onboardingStep: 'domain',
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('user.profile.GET', userId);

  const [doc, inboxSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).get(),
    adminDb.collection('inboxes').where('userId', '==', userId).get(),
  ]);

  const profile = doc.exists ? doc.data() : mockProfile(userId);
  const inboxes = inboxSnap.docs.map((d) => d.data());

  // Backfill: if Firestore says onboarding is done but Clerk metadata doesn't,
  // update Clerk so the middleware lets them through to the dashboard.
  if (profile?.onboardingCompleted) {
    const { sessionClaims } = auth;
    const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
    if (!meta?.onboardingCompleted) {
      clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { onboardingCompleted: true },
      }).catch((err: unknown) => {
        console.warn('[api:user.profile.GET] failed to backfill Clerk metadata', err);
      });
    }
  }

  return NextResponse.json({ data: { ...profile, inboxes } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateProfileSchema);
  if (parsed.response) return parsed.response;

  const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
  logRequest('user.profile.PATCH', userId, { patch });

  await adminDb.collection('users').doc(userId).set(patch, { merge: true });
  return NextResponse.json({ data: { id: userId, ...patch } });
}
