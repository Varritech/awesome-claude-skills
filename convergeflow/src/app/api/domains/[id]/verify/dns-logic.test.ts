/**
 * Unit tests for DNS verification logic extracted from verify/route.ts.
 *
 * BUG DOCUMENTED: checkTxt uses:
 *   flat.some((r) => r.includes(expected) || expected.includes(r.slice(0, 20)))
 *
 * The second condition — expected.includes(r.slice(0, 20)) — means any record
 * whose first 20 chars appear anywhere in the expected string will pass.
 * For example, a record "v=DKIM1; k=rsa; p=AB" passes against expected
 * "v=DKIM1; k=rsa; p=ABCDEF..." because r.slice(0,20) = "v=DKIM1; k=rsa; p=AB"
 * and that substring IS in expected. But it also means a completely different
 * TXT record could accidentally match if its first 20 chars happen to appear
 * in the expected string. These tests document both the working behavior and
 * the fragile edge case.
 */

import { describe, it, expect } from "vitest";

// Re-implement the logic verbatim from verify/route.ts for isolated testing
function checkTxtLogic(records: string[][], expected: string): "green" | "red" {
  const flat = records.map((r) => r.join("")).filter(Boolean);
  const matched = flat.some((r) => r.includes(expected) || expected.includes(r.slice(0, 20)));
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
  it("returns green when TXT record contains expected value", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 include:_spf.mailforge.com ~all"]],
        "v=spf1 include:_spf.mailforge.com"
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
        "v=spf1 include:_spf.mailforge.com"
      )
    ).toBe("green");
  });

  /**
   * BUG: The reverse check `expected.includes(r.slice(0, 20))` can produce
   * false positives. A short or generic TXT record whose first 20 chars match
   * a substring of the expected value passes even if it's a different record.
   *
   * Example: expected = "v=DKIM1; k=rsa; p=ABCD..."
   *          record    = "v=DKIM1; k=rsa; p=" (empty DKIM — should be red)
   *          r.slice(0, 20) = "v=DKIM1; k=rsa; p=" → expected.includes that → GREEN (wrong!)
   */
  it("BUG: empty DKIM record (p= with no key) passes reverse-includes check", () => {
    const emptyDkim = "v=DKIM1; k=rsa; p=";
    const expected = "v=DKIM1; k=rsa; p=ABCDEF1234567890abcdef";
    // r.slice(0,20) = "v=DKIM1; k=rsa; p=" which IS in expected → false positive
    const result = checkTxtLogic([[emptyDkim]], expected);
    // This test documents the bug: result is 'green' when it should be 'red'
    expect(result).toBe("green"); // WRONG — remove this when bug is fixed
  });

  it("CORRECT behavior (post-fix): empty DKIM p= should return red", () => {
    // When fixed, the check should require r.includes(expected) only (not the reverse)
    // Document expected post-fix behavior:
    const emptyDkim = "v=DKIM1; k=rsa; p=";
    const expected = "v=DKIM1; k=rsa; p=ABCDEF1234567890abcdef";
    // Strict forward-only check:
    const flat = [emptyDkim];
    const strictResult = flat.some((r) => r.includes(expected));
    expect(strictResult).toBe(false); // correct: empty DKIM should be red
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
