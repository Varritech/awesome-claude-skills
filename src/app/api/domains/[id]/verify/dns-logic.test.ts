/**
 * Unit tests for DNS verification logic in verify/route.ts.
 *
 * The previous implementation used:
 *   flat.some((r) => r.includes(expected) || expected.includes(r.slice(0, 20)))
 * which silently passed unrelated records that shared a generic 20-char prefix
 * (e.g. a Google SPF record passing a Resend SPF check because both start
 * with `v=spf1 include:_spf.`). It also marked empty DKIM placeholders green.
 *
 * The fixed implementation matches per-protocol signatures: SPF requires the
 * full `include:<sender>` token, DKIM requires a real `p=<key>` with at least
 * 16 base64 characters, and DMARC just needs the `v=DMARC1` marker.
 */

import { describe, it, expect } from "vitest";

type Record = "spf" | "dkim" | "dmarc";

function extractMatchSignature(record: Record, expected: string): string | null {
  if (record === "spf") {
    const m = expected.match(/include:[^\s"]+/);
    return m ? m[0] : null;
  }
  if (record === "dkim") {
    const m = expected.match(/p=([A-Za-z0-9+/=]{16,})/);
    return m ? `p=${m[1]}` : null;
  }
  if (record === "dmarc") {
    return "v=DMARC1";
  }
  return null;
}

function checkTxtLogic(
  records: string[][],
  expected: string,
  record: Record,
): "green" | "red" {
  const flat = records.map((r) => r.join("")).filter(Boolean);

  if (record === "dkim") {
    const sig = extractMatchSignature("dkim", expected);
    if (!sig) return "red";
    const matched = flat.some((r) => {
      const m = r.match(/p=([A-Za-z0-9+/=]{16,})/);
      if (!m) return false;
      return r.includes(sig) || sig.includes(`p=${m[1]}`);
    });
    return matched ? "green" : "red";
  }

  const sig = extractMatchSignature(record, expected);
  if (!sig) {
    const matched = flat.some((r) => r.includes(expected));
    return matched ? "green" : "red";
  }
  const matched = flat.some((r) => r.includes(sig));
  return matched ? "green" : "red";
}

function overallLogic(
  statuses: Array<"pending" | "red" | "yellow" | "green">,
): "pending" | "red" | "yellow" | "green" {
  if (statuses.every((s) => s === "green")) return "green";
  if (statuses.includes("red")) return "red";
  return "yellow";
}

describe("SPF verification", () => {
  it("returns green when SPF record exactly contains include:_resend.com", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 include:_resend.com ~all"]],
        "v=spf1 include:_resend.com ~all",
        "spf",
      ),
    ).toBe("green");
  });

  it("returns red when SPF points to a different sender (Google instead of Resend)", () => {
    // This is the false-positive the old code allowed. The fix must reject it.
    expect(
      checkTxtLogic(
        [["v=spf1 include:_spf.google.com ~all"]],
        "v=spf1 include:_resend.com ~all",
        "spf",
      ),
    ).toBe("red");
  });

  it("returns green for SPF that includes Resend plus other senders", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 include:_spf.google.com include:_resend.com ~all"]],
        "v=spf1 include:_resend.com ~all",
        "spf",
      ),
    ).toBe("green");
  });

  it("returns red when no SPF record present at all", () => {
    expect(
      checkTxtLogic([], "v=spf1 include:_resend.com ~all", "spf"),
    ).toBe("red");
  });

  it("handles multi-chunk TXT records (joined before match)", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 ", "include:_resend.com ~all"]],
        "v=spf1 include:_resend.com ~all",
        "spf",
      ),
    ).toBe("green");
  });
});

describe("DKIM verification (placeholder-aware)", () => {
  it("returns red when expected DKIM has empty p= (no key issued yet)", () => {
    // Placeholder used as fallback when Resend hasn't issued the key.
    // We must NEVER report green for the placeholder; downstream signers
    // would fail Gmail's DKIM check.
    const placeholder = "v=DKIM1; k=rsa; p=";
    expect(checkTxtLogic([["v=DKIM1; k=rsa; p=ABCDEF1234567890abcdef"]], placeholder, "dkim")).toBe(
      "red",
    );
  });

  it("returns red when published record has empty p= but expected has a real key", () => {
    const placeholder = "v=DKIM1; k=rsa; p=";
    const realExpected = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADC...";
    expect(checkTxtLogic([[placeholder]], realExpected, "dkim")).toBe("red");
  });

  it("returns green when published key exactly matches expected", () => {
    const expected = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ";
    expect(checkTxtLogic([[expected]], expected, "dkim")).toBe("green");
  });

  it("returns red when no DKIM record present", () => {
    expect(
      checkTxtLogic(
        [],
        "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ",
        "dkim",
      ),
    ).toBe("red");
  });
});

describe("DMARC verification", () => {
  it("returns green when record starts with v=DMARC1 regardless of policy", () => {
    expect(
      checkTxtLogic(
        [["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"]],
        "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io",
        "dmarc",
      ),
    ).toBe("green");
  });

  it("returns red when no DMARC record present", () => {
    expect(
      checkTxtLogic([], "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io", "dmarc"),
    ).toBe("red");
  });

  it("returns red for an SPF record on the DMARC host (wrong protocol)", () => {
    expect(
      checkTxtLogic(
        [["v=spf1 include:_spf.google.com ~all"]],
        "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io",
        "dmarc",
      ),
    ).toBe("red");
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
