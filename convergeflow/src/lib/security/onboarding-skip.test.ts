/**
 * Tests for onboarding skip logic.
 * Verifies the pure decision logic (should show banner, can skip, etc.)
 */
import { describe, it, expect } from 'vitest';

// Pure functions that power the skip-mode feature
function shouldShowSetupBanner(onboardingCompleted: boolean, onboardingSkipped: boolean): boolean {
  return !onboardingCompleted && !onboardingSkipped;
}

function canAccessDashboard(onboardingCompleted: boolean, onboardingSkipped: boolean): boolean {
  return onboardingCompleted || onboardingSkipped;
}

describe('onboarding skip logic', () => {
  describe('shouldShowSetupBanner', () => {
    it('shows banner when not completed and not skipped', () => {
      expect(shouldShowSetupBanner(false, false)).toBe(true);
    });

    it('hides banner when onboarding is completed', () => {
      expect(shouldShowSetupBanner(true, false)).toBe(false);
    });

    it('hides banner when onboarding was skipped', () => {
      expect(shouldShowSetupBanner(false, true)).toBe(false);
    });

    it('hides banner when both completed and skipped (edge case)', () => {
      expect(shouldShowSetupBanner(true, true)).toBe(false);
    });
  });

  describe('canAccessDashboard', () => {
    it('allows access when onboarding completed', () => {
      expect(canAccessDashboard(true, false)).toBe(true);
    });

    it('allows access when onboarding skipped', () => {
      expect(canAccessDashboard(false, true)).toBe(true);
    });

    it('denies access when neither completed nor skipped', () => {
      expect(canAccessDashboard(false, false)).toBe(false);
    });
  });
});
