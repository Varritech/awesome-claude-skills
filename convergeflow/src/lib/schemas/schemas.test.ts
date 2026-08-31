import { describe, it, expect } from "vitest";
import { createCampaignSchema, emailStatusSchema, replyCategorySchema } from "./campaign";
import { connectDomainSchema, connectInboxSchema } from "./domain";

describe("createCampaignSchema", () => {
  it("accepts minimal valid input (name only)", () => {
    const result = createCampaignSchema.safeParse({ name: "My Campaign" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.persona).toBe("closer"); // default
    }
  });

  it("rejects empty name", () => {
    const result = createCampaignSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 120 chars", () => {
    const result = createCampaignSchema.safeParse({ name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects negative targetLeadCount", () => {
    const result = createCampaignSchema.safeParse({ name: "Test", targetLeadCount: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects targetLeadCount over 10,000", () => {
    const result = createCampaignSchema.safeParse({ name: "Test", targetLeadCount: 10_001 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid persona", () => {
    const result = createCampaignSchema.safeParse({ name: "Test", persona: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid persona values", () => {
    for (const persona of ["closer", "neighbor", "expert", "helper"] as const) {
      const result = createCampaignSchema.safeParse({ name: "Test", persona });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid scheduledAt (not ISO datetime)", () => {
    const result = createCampaignSchema.safeParse({ name: "Test", scheduledAt: "2026-05-12" }); // date only, not datetime
    expect(result.success).toBe(false);
  });

  it("accepts valid scheduledAt ISO datetime", () => {
    const result = createCampaignSchema.safeParse({
      name: "Test",
      scheduledAt: "2026-05-12T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("connectDomainSchema", () => {
  it("accepts valid domain", () => {
    const result = connectDomainSchema.safeParse({ domain: "send.example.com" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.purpose).toBe("sending"); // default
  });

  it("rejects domain without TLD", () => {
    const result = connectDomainSchema.safeParse({ domain: "nodot" });
    expect(result.success).toBe(false);
  });

  it("rejects domain shorter than 3 chars", () => {
    const result = connectDomainSchema.safeParse({ domain: "a.b" });
    // a.b is 3 chars but TLD is only 1 char — regex requires 2+ chars TLD
    expect(result.success).toBe(false);
  });

  it("accepts purpose=primary", () => {
    const result = connectDomainSchema.safeParse({ domain: "example.com", purpose: "primary" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid purpose", () => {
    const result = connectDomainSchema.safeParse({ domain: "example.com", purpose: "outbound" });
    expect(result.success).toBe(false);
  });
});

describe("connectInboxSchema", () => {
  const validSmtp = {
    provider: "smtp_imap" as const,
    email: "sender@example.com",
    smtp: { host: "smtp.example.com", port: 587, user: "sender@example.com", password: "pass" },
  };

  it("accepts valid SMTP inbox", () => {
    const result = connectInboxSchema.safeParse(validSmtp);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email address", () => {
    const result = connectInboxSchema.safeParse({ ...validSmtp, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid SMTP port (0)", () => {
    const result = connectInboxSchema.safeParse({
      ...validSmtp,
      smtp: { ...validSmtp.smtp, port: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid provider", () => {
    const result = connectInboxSchema.safeParse({ ...validSmtp, provider: "outlook" });
    expect(result.success).toBe(false);
  });

  it("accepts gmail provider without smtp block", () => {
    const result = connectInboxSchema.safeParse({
      provider: "gmail",
      email: "user@gmail.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts gmail provider WITHOUT email (OAuth supplies it after consent)", () => {
    const result = connectInboxSchema.safeParse({ provider: "gmail" });
    expect(result.success).toBe(true);
  });

  it("accepts yahoo provider without email", () => {
    const result = connectInboxSchema.safeParse({ provider: "yahoo" });
    expect(result.success).toBe(true);
  });

  it("rejects smtp_imap inbox with no email (SMTP needs an address up front)", () => {
    const result = connectInboxSchema.safeParse({
      provider: "smtp_imap",
      smtp: { host: "smtp.example.com", port: 587, user: "u", password: "p" },
    });
    expect(result.success).toBe(false);
  });
});

describe("emailStatusSchema", () => {
  it("accepts all valid statuses", () => {
    for (const status of ["draft", "queued", "sent", "opened", "replied", "bounced"] as const) {
      expect(emailStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    expect(emailStatusSchema.safeParse("paused").success).toBe(false);
  });

  /**
   * BUG DOCUMENTED: campaign-pause sets email status to 'paused' in Firestore,
   * but 'paused' is NOT in emailStatusSchema. This means if any code tries to
   * validate a paused email record through the schema, it will fail silently.
   * The schema needs a 'paused' status or the pause mechanism needs a different field.
   */
  it("BUG: paused is not a valid email status in schema (but campaign-pause writes it)", () => {
    const result = emailStatusSchema.safeParse("paused");
    expect(result.success).toBe(false); // documents the schema/data mismatch
  });
});

describe("replyCategorySchema", () => {
  it("accepts all valid categories", () => {
    for (const cat of ["interested", "booked", "question", "not_interested", "auto_reply"] as const) {
      expect(replyCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it("rejects unknown category", () => {
    expect(replyCategorySchema.safeParse("spam").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(replyCategorySchema.safeParse("").success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(replyCategorySchema.safeParse(123).success).toBe(false);
    expect(replyCategorySchema.safeParse(null).success).toBe(false);
    expect(replyCategorySchema.safeParse(undefined).success).toBe(false);
  });
});

describe("connectInboxSchema IMAP fields", () => {
  it("accepts valid IMAP config", () => {
    const result = connectInboxSchema.safeParse({
      provider: "smtp_imap",
      email: "sender@example.com",
      smtp: { host: "smtp.example.com", port: 587, user: "sender@example.com", password: "pass" },
      imap: { host: "imap.example.com", port: 993, user: "sender@example.com", password: "pass" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts IMAP with default port", () => {
    const result = connectInboxSchema.safeParse({
      provider: "smtp_imap",
      email: "sender@example.com",
      smtp: { host: "smtp.example.com", port: 587, user: "sender@example.com", password: "pass" },
      imap: { host: "imap.example.com", user: "sender@example.com", password: "pass" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imap?.port).toBe(993);
    }
  });

  it("rejects IMAP with invalid port (0)", () => {
    const result = connectInboxSchema.safeParse({
      provider: "smtp_imap",
      email: "sender@example.com",
      smtp: { host: "smtp.example.com", port: 587, user: "sender@example.com", password: "pass" },
      imap: { host: "imap.example.com", port: 0, user: "sender@example.com", password: "pass" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts inbox without IMAP (optional field)", () => {
    const result = connectInboxSchema.safeParse({
      provider: "gmail",
    });
    expect(result.success).toBe(true);
  });
});
