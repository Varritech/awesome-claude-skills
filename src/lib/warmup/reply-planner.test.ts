import { describe, it, expect } from "vitest";
import {
  matchWarmupPoolRecipient,
  buildWarmupReply,
  WARMUP_REPLY_BODIES,
} from "./reply-planner";

const POOL = [
  "warmup1@pool.example.com",
  "warmup2@pool.example.com",
  "warmup3@pool.example.com",
];

describe("matchWarmupPoolRecipient", () => {
  it("returns the pool address when a recipient is in the pool", () => {
    expect(
      matchWarmupPoolRecipient(["warmup2@pool.example.com"], POOL),
    ).toBe("warmup2@pool.example.com");
  });

  it("returns null when no recipient is in the pool (real customer reply)", () => {
    expect(matchWarmupPoolRecipient(["someone@acme.com"], POOL)).toBeNull();
  });

  it("finds the pool address among multiple recipients", () => {
    expect(
      matchWarmupPoolRecipient(
        ["lead@acme.com", "warmup3@pool.example.com"],
        POOL,
      ),
    ).toBe("warmup3@pool.example.com");
  });

  it("is case-insensitive on the recipient address", () => {
    expect(
      matchWarmupPoolRecipient(["WARMUP1@pool.example.com"], POOL),
    ).toBe("warmup1@pool.example.com");
  });

  it("returns null for an empty recipient list", () => {
    expect(matchWarmupPoolRecipient([], POOL)).toBeNull();
  });
});

describe("buildWarmupReply", () => {
  const inbound = {
    from: "christian@christianvarriale.com",
    toRecipient: "warmup2@pool.example.com",
    subject: "Checking in",
    messageId: "<abc-123@gmail.com>",
  };

  it("replies FROM the pool address TO the original sender", () => {
    const reply = buildWarmupReply(inbound);
    expect(reply.from).toBe("warmup2@pool.example.com");
    expect(reply.to).toBe("christian@christianvarriale.com");
  });

  it("prefixes the subject with Re: (and does not double-prefix)", () => {
    expect(buildWarmupReply(inbound).subject).toBe("Re: Checking in");
    expect(
      buildWarmupReply({ ...inbound, subject: "Re: Checking in" }).subject,
    ).toBe("Re: Checking in");
  });

  it("threads on the original message via In-Reply-To + References", () => {
    const reply = buildWarmupReply(inbound);
    expect(reply.headers["In-Reply-To"]).toBe("<abc-123@gmail.com>");
    expect(reply.headers["References"]).toBe("<abc-123@gmail.com>");
  });

  it("picks a body from the cycled list (deterministic per messageId)", () => {
    const reply = buildWarmupReply(inbound);
    expect(WARMUP_REPLY_BODIES).toContain(reply.text);
    // same messageId → same body index
    const again = buildWarmupReply(inbound);
    expect(again.text).toBe(reply.text);
    // different messageId → likely a different body (cycle advances)
    const other = buildWarmupReply({ ...inbound, messageId: "<def-456@gmail.com>" });
    expect(WARMUP_REPLY_BODIES).toContain(other.text);
  });

  it("wraps the body in HTML", () => {
    const reply = buildWarmupReply(inbound);
    expect(reply.html).toContain(reply.text);
    expect(reply.html).toContain("<p>");
  });

  it("tags the reply with an X-Convergeflow-Warmup header so it is not treated as a real customer reply", () => {
    const reply = buildWarmupReply(inbound);
    expect(reply.headers["X-Convergeflow-Warmup"]).toBe("1");
  });
});