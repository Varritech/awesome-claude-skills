import { describe, it, expect } from "vitest";
import { checkCompliance } from "./compliance";

const GOOD_BODY =
  "Hi Jane, I wanted to reach out about our platform. If you're not interested, click here to unsubscribe.";

const GOOD_SUBJECT = "Quick question about your outreach";

describe("checkCompliance", () => {
  it("passes when body has unsubscribe link and subject is clean", () => {
    const result = checkCompliance({ subject: GOOD_SUBJECT, body: GOOD_BODY });
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes when body has a physical address instead of unsubscribe", () => {
    const body = "Hi Jane, check us out. We are located at 123 Main Street, Austin TX 78701.";
    const result = checkCompliance({ subject: GOOD_SUBJECT, body });
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when body has neither unsubscribe link nor physical address", () => {
    const body = "Hi Jane, just wanted to say hello and see if you have time to chat.";
    const result = checkCompliance({ subject: GOOD_SUBJECT, body });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("can-spam"))).toBe(true);
  });

  it('errors on subject line starting with "Re:"', () => {
    const result = checkCompliance({ subject: "Re: following up", body: GOOD_BODY });
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('errors on subject line starting with "Fwd:"', () => {
    const result = checkCompliance({ subject: "Fwd: important document", body: GOOD_BODY });
    expect(result.passed).toBe(false);
  });

  it('errors on subject with "You Won"', () => {
    const result = checkCompliance({ subject: "You won a prize!", body: GOOD_BODY });
    expect(result.passed).toBe(false);
  });

  it("warns when body is shorter than 50 chars", () => {
    const shortBody = "Hi. unsubscribe";
    const result = checkCompliance({ subject: GOOD_SUBJECT, body: shortBody });
    expect(result.warnings.some((w) => w.includes("short"))).toBe(true);
  });

  it("warns when body exceeds 2000 chars", () => {
    const longBody = "a".repeat(2001) + " unsubscribe";
    const result = checkCompliance({ subject: GOOD_SUBJECT, body: longBody });
    expect(result.warnings.some((w) => w.includes("long"))).toBe(true);
  });

  it("warns when subject is empty", () => {
    const result = checkCompliance({ subject: "", body: GOOD_BODY });
    expect(result.warnings.some((w) => w.toLowerCase().includes("subject"))).toBe(true);
  });

  it("returns passed:false even if warnings exist but errors are present", () => {
    const result = checkCompliance({ subject: "Re: hey", body: "short unsubscribe" });
    // Short body (warning) + Re: subject (error) + possibly CAN-SPAM error
    expect(result.passed).toBe(false);
  });

  it("passes with no warnings for a well-formed email", () => {
    const body =
      'Hi {{firstName}}, I noticed you run {{company}} in the {{industry}} space. I wanted to introduce a solution that might help. Happy to jump on a quick call.\n\nTo unsubscribe, reply with "unsubscribe".';
    const result = checkCompliance({ subject: "Quick question about your outreach", body });
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
