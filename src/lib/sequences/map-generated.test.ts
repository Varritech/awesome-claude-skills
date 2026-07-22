import { describe, it, expect } from "vitest";
import { generatedEmailsToSteps } from "./map-generated";
import type { GeneratedEmail } from "@/lib/ai/sequence-generator";

const g = (n: 1 | 2 | 3 | 4 | 5, dayOffset: number, variant: "A" | "B", subject: string): GeneratedEmail => ({
  emailNumber: n,
  dayOffset,
  subject,
  body: `body ${n}`,
  variant,
  plainText: true,
});

describe("generatedEmailsToSteps", () => {
  it("maps A-variant emails to sequence steps in emailNumber order", () => {
    const steps = generatedEmailsToSteps([
      g(1, 0, "A", "Intro"),
      g(2, 2, "A", "Value"),
      g(3, 4, "A", "Proof"),
    ]);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.subject)).toEqual(["Intro", "Value", "Proof"]);
    expect(steps.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("drops B-variant (split-test) emails", () => {
    const steps = generatedEmailsToSteps([
      g(1, 0, "A", "Intro A"),
      g(1, 0, "B", "Intro B"),
      g(2, 2, "A", "Follow A"),
      g(2, 2, "B", "Follow B"),
    ]);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.subject)).toEqual(["Intro A", "Follow A"]);
  });

  it("uses dayOffset as delayDays and an always-condition", () => {
    const steps = generatedEmailsToSteps([g(2, 3, "A", "Wait 3")]);
    expect(steps[0]!.delayDays).toBe(3);
    expect(steps[0]!.condition).toEqual({ type: "always", afterDays: 0 });
    expect(steps[0]!.body).toBe("body 2");
  });

  it("returns an empty array when there are no A-variant emails", () => {
    expect(generatedEmailsToSteps([g(1, 0, "B", "only B")])).toEqual([]);
    expect(generatedEmailsToSteps([])).toEqual([]);
  });
});