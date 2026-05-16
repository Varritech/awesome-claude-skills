import { describe, it, expect } from "vitest";
import { groupByThread, computeThreadId } from "./threading";
import type { Email } from "@/lib/schemas/campaign";

function makeEmail(overrides: Partial<Email> = {}): Email {
  const base: Email = {
    id: "e1",
    userId: "u1",
    campaignId: "c1",
    leadId: "l1",
    subject: "Hello",
    body: "Body text",
    persona: "closer",
    status: "sent",
    sentAt: "2024-01-10T10:00:00.000Z",
    openedAt: null,
    repliedAt: null,
    createdAt: "2024-01-10T09:00:00.000Z",
    updatedAt: "2024-01-10T10:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("groupByThread", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByThread([])).toEqual([]);
  });

  it("groups emails with the same leadId + campaignId into one thread", () => {
    const emails = [
      makeEmail({ id: "e1", leadId: "l1", campaignId: "c1" }),
      makeEmail({
        id: "e2",
        leadId: "l1",
        campaignId: "c1",
        sentAt: "2024-01-11T10:00:00.000Z",
        updatedAt: "2024-01-11T10:00:00.000Z",
      }),
    ];
    const threads = groupByThread(emails);
    expect(threads).toHaveLength(1);
    expect(threads[0].emails).toHaveLength(2);
    expect(threads[0].id).toBe("l1_c1");
  });

  it("creates separate threads for different leadIds", () => {
    const emails = [
      makeEmail({ id: "e1", leadId: "l1", campaignId: "c1" }),
      makeEmail({ id: "e2", leadId: "l2", campaignId: "c1" }),
    ];
    const threads = groupByThread(emails);
    expect(threads).toHaveLength(2);
  });

  it("creates separate threads for different campaignIds", () => {
    const emails = [
      makeEmail({ id: "e1", leadId: "l1", campaignId: "c1" }),
      makeEmail({ id: "e2", leadId: "l1", campaignId: "c2" }),
    ];
    const threads = groupByThread(emails);
    expect(threads).toHaveLength(2);
  });

  it("sorts threads by lastActivity descending (newest first)", () => {
    const emails = [
      makeEmail({
        id: "e1",
        leadId: "l1",
        campaignId: "c1",
        sentAt: "2024-01-05T10:00:00.000Z",
        updatedAt: "2024-01-05T10:00:00.000Z",
      }),
      makeEmail({
        id: "e2",
        leadId: "l2",
        campaignId: "c1",
        sentAt: "2024-01-10T10:00:00.000Z",
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
      makeEmail({
        id: "e3",
        leadId: "l3",
        campaignId: "c1",
        sentAt: "2024-01-08T10:00:00.000Z",
        updatedAt: "2024-01-08T10:00:00.000Z",
      }),
    ];
    const threads = groupByThread(emails);
    expect(threads[0].leadId).toBe("l2");
    expect(threads[1].leadId).toBe("l3");
    expect(threads[2].leadId).toBe("l1");
  });

  it("uses repliedAt as lastActivity when available", () => {
    const emails = [
      makeEmail({
        id: "e1",
        leadId: "l1",
        campaignId: "c1",
        sentAt: "2024-01-01T10:00:00.000Z",
        repliedAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:00:00.000Z",
      }),
      makeEmail({
        id: "e2",
        leadId: "l2",
        campaignId: "c1",
        sentAt: "2024-01-10T10:00:00.000Z",
        repliedAt: null,
        updatedAt: "2024-01-10T10:00:00.000Z",
      }),
    ];
    const threads = groupByThread(emails);
    expect(threads[0].leadId).toBe("l1"); // repliedAt is latest
    expect(threads[0].lastActivity).toBe("2024-01-15T10:00:00.000Z");
  });

  it("handles emails with no leadId or campaignId using __unknown__ sentinel", () => {
    const emails = [makeEmail({ id: "e1", leadId: undefined, campaignId: undefined })];
    const threads = groupByThread(emails);
    expect(threads[0].id).toBe("__unknown_____unknown__");
  });
});

describe("computeThreadId", () => {
  it("computes threadId from leadId and campaignId", () => {
    expect(computeThreadId("l1", "c1")).toBe("l1_c1");
  });

  it("uses __unknown__ for undefined values", () => {
    expect(computeThreadId(undefined, undefined)).toBe("__unknown_____unknown__");
    expect(computeThreadId("l1", undefined)).toBe("l1___unknown__");
  });
});
