/**
 * Unit tests for DNS verification logic extracted from verify/route.ts.
 *
 * Logic: checkTxt uses exact string matching (trimmed).
 *   flat.some((r) => r.trim() === expected.trim())
 *
 * The previous loose check — expected.includes(r.slice(0, 20)) — allowed false
 * positives where an empty or partial TXT record could pass verification. That
 * bug is now fixed. These tests document correct post-fix behavior.
 */

import { describe, it, expect } from "vitest";

// Re-implement the logic verbatim from verify/route.ts for isolated testing
function checkTxtLogic(records: string[][], expected: string): "green" | "red" {
  const flat = records.map((r) => r.join("")).filter(Boolean);
  const matched = flat.some((r) => r.trim() === expected.trim());
  return matched ? "green" : "red";
}

function overallLogic(
  statuses: Array<"pending" | "red" | "yellow" | "green">
): "pending" | "red" | "yellow" | "green" {
  if (statuses.every((s) => s === "green")) return "green";
  if (statuses.includes("red")) return "red";
  return "yellow";
}

describe("checkTxt logic (extracted from verify/route.ts)", () => {
  it("returns green when TXT record exactly matches expected value", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 include:_spf.mailforge.com ~all"]],
        "v=spf1 include:_spf.mailforge.com ~all"
      )
    ).toBe("green");
  });

  it("returns red when no TXT record matches", () => {
    expect(
      checkTxtLogic([["v=spf1 include:other.com ~all"]], "v=spf1 include:_spf.mailforge.com")
    ).toBe("red");
  });

  it("returns red when record list is empty", () => {
    expect(checkTxtLogic([], "v=spf1 include:_spf.mailforge.com")).toBe("red");
  });

  it("handles multi-chunk TXT records (array of strings joined)", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 ", "include:_spf.mailforge.com ~all"]],
        "v=spf1 include:_spf.mailforge.com ~all"
      )
    ).toBe("green");
  });

  it("empty DKIM record (p= with no key) returns red", () => {
    const emptyDkim = "v=DKIM1; k=rsa; p=";
    const expected = "v=DKIM1; k=rsa; p=ABCDEF1234567890abcdef";
    expect(checkTxtLogic([[emptyDkim]], expected)).toBe("red");
  });

  it("exact DKIM record match returns green", () => {
    const fullDkim = "v=DKIM1; k=rsa; p=ABCDEF1234567890abcdef";
    expect(checkTxtLogic([[fullDkim]], fullDkim)).toBe("green");
  });
});

describe("overall status aggregation", () => {
  it("returns green when all statuses are green", () => {
    expect(overallLogic(["green", "green", "green", "green"])).toBe("green");
  });

  it("returns red when any status is red", () => {
    expect(overallLogic(["green", "green", "red", "green"])).toBe("red");
  });

  it("returns yellow when mixed green and pending (no red)", () => {
    expect(overallLogic(["green", "green", "pending", "green"])).toBe("yellow");
  });

  it("returns yellow when mixed green and yellow (no red)", () => {
    expect(overallLogic(["green", "yellow", "green", "green"])).toBe("yellow");
  });

  it("prefers red over yellow", () => {
    expect(overallLogic(["green", "yellow", "red", "green"])).toBe("red");
  });
});
