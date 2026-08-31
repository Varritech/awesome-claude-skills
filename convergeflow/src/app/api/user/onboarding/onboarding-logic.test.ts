/**
 * Unit tests for onboarding step progression logic from /api/user/onboarding/route.ts.
 *
 * Extracted logic:
 *   const nextStep = completed
 *     ? (STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)] as Step)
 *     : step;
 *   const isFinished = nextStep === 'complete';
 */

import { describe, it, expect } from "vitest";

type Step = "profile" | "domain" | "inbox" | "leads" | "persona" | "first_campaign" | "complete";

const STEP_ORDER: Step[] = [
  "profile",
  "domain",
  "inbox",
  "leads",
  "persona",
  "first_campaign",
  "complete",
];

function computeNextStep(step: Step, completed: boolean): { nextStep: Step; isFinished: boolean } {
  const nextStep = completed
    ? (STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)] as Step)
    : step;
  const isFinished = nextStep === "complete";
  return { nextStep, isFinished };
}

describe("onboarding step progression", () => {
  it("stays on same step when completed=false", () => {
    const { nextStep, isFinished } = computeNextStep("profile", false);
    expect(nextStep).toBe("profile");
    expect(isFinished).toBe(false);
  });

  it("advances from profile to domain on complete", () => {
    const { nextStep } = computeNextStep("profile", true);
    expect(nextStep).toBe("domain");
  });

  it("advances through all steps in order", () => {
    const steps: Step[] = ["profile", "domain", "inbox", "leads", "persona", "first_campaign"];
    const expected: Step[] = ["domain", "inbox", "leads", "persona", "first_campaign", "complete"];

    steps.forEach((step, i) => {
      const { nextStep } = computeNextStep(step, true);
      expect(nextStep).toBe(expected[i]);
    });
  });

  it("returns isFinished=true when advancing from first_campaign", () => {
    const { nextStep, isFinished } = computeNextStep("first_campaign", true);
    expect(nextStep).toBe("complete");
    expect(isFinished).toBe(true);
  });

  it("does not go past complete (clamped at last index)", () => {
    // complete is already the last step — completing it stays at complete
    const { nextStep } = computeNextStep("complete", true);
    expect(nextStep).toBe("complete");
  });

  it("isFinished is false for all non-final steps", () => {
    const nonFinal: Step[] = ["profile", "domain", "inbox", "leads", "persona"];
    nonFinal.forEach((step) => {
      const { isFinished } = computeNextStep(step, true);
      expect(isFinished).toBe(false);
    });
  });
});
