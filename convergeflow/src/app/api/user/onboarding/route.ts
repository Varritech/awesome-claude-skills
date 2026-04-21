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

  try {
    const doc = await adminDb.collection('onboarding').doc(userId).get();
    if (!doc.exists) {
      return NextResponse.json({ data: mockState(userId) });
    }
    return NextResponse.json({ data: doc.data() });
  } catch (err) {
    console.warn('[api:user.onboarding.GET] falling back to mock', err);
    return NextResponse.json({ data: mockState(userId) });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, updateOnboardingSchema);
  if (parsed.response) return parsed.response;

  const { step, completed, ...rest } = parsed.data;

  const nextStep =
    step && completed
      ? (STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)] as Step)
      : step;
  const isFinished = nextStep === 'complete';

  const patch: Record<string, unknown> = {
    userId,
    ...rest,
    ...(nextStep !== undefined && { step: nextStep }),
    ...(completed !== undefined && { completed: isFinished }),
    ...(step && completed !== undefined && { [`stepsCompleted.${step}`]: completed }),
    updatedAt: new Date().toISOString(),
  };

  logRequest('user.onboarding.PATCH', userId, patch);

  try {
    await adminDb.collection('onboarding').doc(userId).set(patch, { merge: true });
  } catch (err) {
    console.warn('[api:user.onboarding.PATCH] placeholder mode', err);
  }

  return NextResponse.json({ data: patch });
}
