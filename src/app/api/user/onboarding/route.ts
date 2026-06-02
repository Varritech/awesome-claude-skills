/**
 * /api/user/onboarding - read & update onboarding progress.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { updateOnboardingSchema } from '@/lib/schemas';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

type Step =
  | 'profile'
  | 'domain'
  | 'inbox'
  | 'leads'
  | 'persona'
  | 'first_campaign'
  | 'complete';

interface OnboardingState {
  userId: string;
  step: Step;
  completed: boolean;
  stepsCompleted: Partial<Record<Step, boolean>>;
  updatedAt: string;
}

const STEP_ORDER: Step[] = [
  'profile',
  'domain',
  'inbox',
  'leads',
  'persona',
  'first_campaign',
  'complete',
];

function mockState(userId: string): OnboardingState {
  return {
    userId,
    step: 'domain',
    completed: false,
    stepsCompleted: { profile: true },
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('user.onboarding.GET', userId);

  const doc = await adminDb.collection('onboarding').doc(userId).get();
  if (!doc.exists) {
    return NextResponse.json({ data: mockState(userId) });
  }
  return NextResponse.json({ data: doc.data() });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateOnboardingSchema);
  if (parsed.response) return parsed.response;
  const { step, completed, industry, industryOther, persona, onboardingComplete } = parsed.data;

  logRequest('user.onboarding.PATCH', userId, { step, completed, industry });

  let patch: Record<string, unknown> = { userId, updatedAt: new Date().toISOString() };

  // Industry-only update (from /onboarding/industry page)
  if (industry !== undefined) {
    const resolvedIndustry = industry === 'other' && industryOther ? industryOther : industry;
    patch = {
      ...patch,
      industry: resolvedIndustry,
      step: 'persona',
      'stepsCompleted.inbox': true,
    };
  } else if (persona !== undefined) {
    patch = { ...patch, persona, step: 'leads', 'stepsCompleted.persona': true };
  } else if (onboardingComplete) {
    patch = { ...patch, step: 'complete', completed: true };
  } else if (step !== undefined && completed !== undefined) {
    // 'persona' is the last user-facing step — completing it finishes onboarding
    const isLastStep = step === 'persona' && completed;
    const nextStep = isLastStep
      ? 'complete'
      : completed
        ? (STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)] as Step)
        : step;
    patch = {
      ...patch,
      step: nextStep,
      completed: nextStep === 'complete',
      [`stepsCompleted.${step}`]: completed,
    };
  }

  const justCompleted = patch.completed === true;

  await adminDb.collection('onboarding').doc(userId).set(patch, { merge: true });

  // Mirror completion to the canonical user profile doc and Clerk so /onboarding
  // (which reads /api/user/profile) and middleware (which reads Clerk metadata)
  // both see the user as onboarded on the very next request. Without this,
  // returning users get bounced back into the flow on every login.
  if (justCompleted) {
    try {
      await adminDb.collection('users').doc(userId).set(
        {
          onboardingCompleted: true,
          onboardingStep: 'complete',
          updatedAt: patch.updatedAt,
        },
        { merge: true },
      );
    } catch (err) {
      console.warn('[api:user.onboarding.PATCH] failed to mirror to users doc', err);
    }
    try {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { onboardingCompleted: true },
      });
    } catch (err) {
      console.warn('[api:user.onboarding.PATCH] failed to update Clerk metadata', err);
    }
  }

  return NextResponse.json({ data: patch });
}
