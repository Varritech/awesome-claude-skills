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

export const dynamic = 'force-dynamic';

type Tier = 'self_serve' | 'openclaw_dwy' | 'enterprise';

interface UserProfileRecord {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  tier: Tier;
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
  phone?: string;
  inboxes?: unknown[];
  preferences?: {
    emailNotifications?: boolean;
    autoFollowUp?: boolean;
    weeklyReport?: boolean;
  };
}

function planFromTier(tier: Tier) {
  const plans: Record<Tier, { tier: string; emailLimitLabel: string; price: string }> = {
    self_serve:    { tier: 'Starter',    emailLimitLabel: '50 emails/day',   price: '$49/mo'   },
    openclaw_dwy:  { tier: 'Pro',        emailLimitLabel: '500 emails/day',  price: '$149/mo'  },
    enterprise:    { tier: 'Enterprise', emailLimitLabel: 'Unlimited',       price: '$399/mo'  },
  };
  return plans[tier] ?? plans['self_serve'];
}

function enrichProfile(raw: UserProfileRecord & Record<string, unknown>) {
  const firstName = raw.firstName ?? '';
  const lastName  = raw.lastName  ?? '';
  const fullName  = `${firstName} ${lastName}`.trim();
  const initials  = fullName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    ...raw,
    fullName,
    avatarInitials: initials || '??',
    phone:        (raw.phone as string | undefined)        ?? '',
    inboxes:      (raw.inboxes as unknown[] | undefined)   ?? [],
    preferences:  (raw.preferences as UserProfileRecord['preferences'] | undefined) ?? {
      emailNotifications: false,
      autoFollowUp:       false,
      weeklyReport:       false,
    },
    plan: planFromTier(raw.tier ?? 'self_serve'),
  };
}

function mockProfile(userId: string) {
  const now = new Date().toISOString();
  const raw: UserProfileRecord = {
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
  return enrichProfile(raw as UserProfileRecord & Record<string, unknown>);
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('user.profile.GET', userId);

  try {
    const doc = await adminDb.collection('users').doc(userId).get();
    if (!doc.exists) {
      return NextResponse.json({ data: mockProfile(userId) });
    }
    const raw = doc.data() as (UserProfileRecord & Record<string, unknown>);
    return NextResponse.json({ data: enrichProfile(raw) });
  } catch (err) {
    console.warn('[api:user.profile.GET] falling back to mock', err);
    return NextResponse.json({ data: mockProfile(userId) });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateProfileSchema);
  if (parsed.response) return parsed.response;

  const patch = { ...parsed.data, updatedAt: new Date().toISOString() };
  logRequest('user.profile.PATCH', userId, { patch });

  try {
    await adminDb.collection('users').doc(userId).set(patch, { merge: true });
  } catch (err) {
    console.warn('[api:user.profile.PATCH] placeholder mode', err);
  }
  return NextResponse.json({ data: { id: userId, ...patch } });
}
