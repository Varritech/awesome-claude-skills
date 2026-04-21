'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SubscriptionTier } from '@/lib/schemas/user';

/**
 * Client-side cache of the signed-in user's Firestore profile.
 *
 * Clerk is the source of truth for identity (id, email, name). This store
 * holds ConvergeFlow-specific profile fields we read from Firestore so the
 * UI can render instantly on navigation without re-fetching.
 */

export interface CurrentUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  tier: SubscriptionTier;
  company?: string;
  industry?: string;
  timezone?: string;
  onboardingCompleted: boolean;
}

interface UserState {
  user: CurrentUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: CurrentUser | null) => void;
  patchUser: (patch: Partial<CurrentUser>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  isLoading: false,
  error: null,
};

export const useUser = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,
      setUser: (user) => set({ user, error: null }),
      patchUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'convergeflow-user',
      storage: createJSONStorage(() => localStorage),
      // Don't persist loading / error state across reloads.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
