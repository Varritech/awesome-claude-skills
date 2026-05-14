/**
 * Unit tests for sequence step condition evaluation logic.
 *
 * Tests cover:
 * - Condition type 'always' triggers regardless of email state
 * - Condition type 'no_reply' triggers only when lead hasn't replied
 * - Condition type 'no_open' triggers only when lead hasn't opened
 * - afterDays gate: step not triggered until enough days have passed
 */

import { describe, it, expect } from "vitest";
import {
  shouldSendNextStep,
  pickRotationInbox,
  calculateBounceRate,
  assignAbVariant,
} from "./sending-logic";

// ─── Sequence step condition evaluation ──────────────────────────────────────

describe("shouldSendNextStep", () => {
  const baseStep = { order: 1, subject: "Hi", body: "Hello", delayDays: 3 };

  it("always condition fires when enough days have passed", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "always", afterDays: 3 },
        step: baseStep,
        leadStatus: "contacted",
        lastStepSentDaysAgo: 3,
      })
    ).toBe(true);
  });

  it("always condition does NOT fire when not enough days have passed", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "always", afterDays: 3 },
        step: baseStep,
        leadStatus: "contacted",
        lastStepSentDaysAgo: 2,
      })
    ).toBe(false);
  });

  it("no_reply condition fires when lead has not replied and days are met", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "no_reply", afterDays: 2 },
        step: baseStep,
        leadStatus: "contacted",
        lastStepSentDaysAgo: 2,
      })
    ).toBe(true);
  });

  it("no_reply condition does NOT fire when lead has replied", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "no_reply", afterDays: 2 },
        step: baseStep,
        leadStatus: "replied",
        lastStepSentDaysAgo: 5,
      })
    ).toBe(false);
  });

  it("no_open condition fires when lead has not opened and days are met", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "no_open", afterDays: 1 },
        step: baseStep,
        leadStatus: "contacted",
        lastStepSentDaysAgo: 1,
      })
    ).toBe(true);
  });

  it("no_open condition does NOT fire when lead has opened", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "no_open", afterDays: 1 },
        step: baseStep,
        leadStatus: "opened",
        lastStepSentDaysAgo: 2,
      })
    ).toBe(false);
  });

  it("no_open condition does NOT fire when lead has replied (implies opened)", () => {
    expect(
      shouldSendNextStep({
        condition: { type: "no_open", afterDays: 1 },
        step: baseStep,
        leadStatus: "replied",
        lastStepSentDaysAgo: 2,
      })
    ).toBe(false);
  });
});

// ─── Multi-inbox rotation ─────────────────────────────────────────────────────

describe("pickRotationInbox", () => {
  const inboxIds = ["inbox_a", "inbox_b", "inbox_c"];

  it("picks inboxIds[0] when emailIndex is 0", () => {
    expect(pickRotationInbox(inboxIds, 0)).toBe("inbox_a");
  });

  it("picks inboxIds[1] when emailIndex is 1", () => {
    expect(pickRotationInbox(inboxIds, 1)).toBe("inbox_b");
  });

  it("wraps around: emailIndex 3 picks inboxIds[0] again", () => {
    expect(pickRotationInbox(inboxIds, 3)).toBe("inbox_a");
  });

  it("wraps correctly at arbitrary large index", () => {
    expect(pickRotationInbox(inboxIds, 7)).toBe("inbox_b"); // 7 % 3 = 1
  });

  it("single inbox always returns that inbox", () => {
    expect(pickRotationInbox(["inbox_only"], 42)).toBe("inbox_only");
  });

  it("throws when inboxIds is empty", () => {
    expect(() => pickRotationInbox([], 0)).toThrow();
  });
});

// ─── Bounce rate calculation ──────────────────────────────────────────────────

describe("calculateBounceRate", () => {
  it("returns 0 when no emails sent", () => {
    expect(calculateBounceRate({ sent: 0, bounced: 0 })).toBe(0);
  });

  it("returns 0 when no bounces", () => {
    expect(calculateBounceRate({ sent: 100, bounced: 0 })).toBe(0);
  });

  it("returns 10 when 10 of 100 bounced", () => {
    expect(calculateBounceRate({ sent: 100, bounced: 10 })).toBe(10);
  });

  it("returns 100 when all emails bounced", () => {
    expect(calculateBounceRate({ sent: 5, bounced: 5 })).toBe(100);
  });

  it("exceeds 10% threshold: 11 of 100 bounced", () => {
    const rate = calculateBounceRate({ sent: 100, bounced: 11 });
    expect(rate).toBeGreaterThan(10);
  });

  it("below 10% threshold: 9 of 100 bounced", () => {
    const rate = calculateBounceRate({ sent: 100, bounced: 9 });
    expect(rate).toBeLessThan(10);
  });
});

// ─── A/B variant assignment ───────────────────────────────────────────────────

describe("assignAbVariant", () => {
  const variants = [
    { label: "A", subjectSuffix: "", bodySuffix: "", weight: 50 },
    { label: "B", subjectSuffix: " [B]", bodySuffix: " — B variant", weight: 50 },
  ];

  it("returns a variant label from the provided variants", () => {
    const label = assignAbVariant(variants, 0.3);
    expect(["A", "B"]).toContain(label);
  });

  it("assigns variant A when random < 0.5 (weight 50/50)", () => {
    expect(assignAbVariant(variants, 0.1)).toBe("A");
    expect(assignAbVariant(variants, 0.49)).toBe("A");
  });

  it("assigns variant B when random >= 0.5 (weight 50/50)", () => {
    expect(assignAbVariant(variants, 0.5)).toBe("B");
    expect(assignAbVariant(variants, 0.99)).toBe("B");
  });

  it("handles unequal weights: 70/30", () => {
    const unequal = [
      { label: "A", subjectSuffix: "", bodySuffix: "", weight: 70 },
      { label: "B", subjectSuffix: "", bodySuffix: "", weight: 30 },
    ];
    expect(assignAbVariant(unequal, 0.69)).toBe("A");
    expect(assignAbVariant(unequal, 0.7)).toBe("B");
  });

  it("handles single variant: always returns that label", () => {
    const single = [{ label: "A", subjectSuffix: "", bodySuffix: "", weight: 100 }];
    expect(assignAbVariant(single, 0.0)).toBe("A");
    expect(assignAbVariant(single, 0.99)).toBe("A");
  });

  it("throws when variants is empty", () => {
    expect(() => assignAbVariant([], 0.5)).toThrow();
  });
});
