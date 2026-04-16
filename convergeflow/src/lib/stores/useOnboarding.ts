'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Tracks progress through the 5-step onboarding flow:
 *   signup -> domain -> inbox -> industry -> style -> path -> (openclaw)? -> dashboard
 *
 * The store persists to localStorage so a user who refreshes mid-flow
 * doesn't have to re-enter each field. Once onboarding completes, call
 * `reset()` to clear local state — the authoritative record lives in
 * Firestore.
 */

export type OnboardingStep =
  | 'signup'
  | 'domain'
  | 'inbox'
  | 'industry'
  | 'style'
  | 'path'
  | 'openclaw'
  | 'complete';

export interface InboxDraft {
  provider?: 'gmail' | 'yahoo' | 'smtp_imap';
  email?: string;
  displayName?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
  };
}

interface OnboardingState {
  step: OnboardingStep;
  domain: string;
  domainPurpose: 'primary' | 'sending';
  inbox: InboxDraft;
  industry: string;
  style: string;
  tone: string;
  path: 'self_serve' | 'openclaw_dwy' | '';
  completedSteps: OnboardingStep[];

  setStep: (step: OnboardingStep) => void;
  setDomain: (domain: string, purpose?: 'primary' | 'sending') => void;
  setInbox: (inbox: InboxDraft) => void;
  setIndustry: (industry: string) => void;
  setStyle: (style: string, tone?: string) => void;
  setPath: (path: 'self_serve' | 'openclaw_dwy') => void;
  markStepComplete: (step: OnboardingStep) => void;
  reset: () => void;
}

const initialState = {
  step: 'signup' as OnboardingStep,
  domain: '',
  domainPurpose: 'sending' as 'primary' | 'sending',
  inbox: {} as InboxDraft,
  industry: '',
  style: '',
  tone: '',
  path: '' as 'self_serve' | 'openclaw_dwy' | '',
  completedSteps: [] as OnboardingStep[],
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ step }),
      setDomain: (domain, purpose = 'sending') =>
        set({ domain, domainPurpose: purpose }),
      setInbox: (inbox) => set({ inbox }),
      setIndustry: (industry) => set({ industry }),
      setStyle: (style, tone = '') => set({ style, tone }),
      setPath: (path) => set({ path }),
      markStepComplete: (step) =>
        set((state) =>
          state.completedSteps.includes(step)
            ? state
            : { completedSteps: [...state.completedSteps, step] },
        ),
      reset: () => set(initialState),
    }),
    {
      name: 'convergeflow-onboarding',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
