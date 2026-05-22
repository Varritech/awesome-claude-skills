/**
 * Tests for the lead deduplication engine.
 *
 * Firestore is mocked — we test the partitioning logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deduplicateLeads } from "./dedup";

// Mock Firestore
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

import { adminDb } from "@/lib/firebase/admin";

const mockCollection = vi.mocked(adminDb.collection);

function makeMockQuery(existingEmails: string[]) {
  const docs = existingEmails.map((email) => ({
    data: () => ({ email }),
  }));
  const snap = { docs };
  const query: Record<string, unknown> = {
    get: vi.fn().mockResolvedValue(snap),
  };
  // where() always returns the same query object (supports chaining)
  query.where = vi.fn().mockReturnValue(query);
  return query;
}

describe("deduplicateLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all leads as unique when none exist in Firestore", async () => {
    const query = makeMockQuery([]);
    mockCollection.mockReturnValue(query as never);

    const incoming = [
      { email: "alice@example.com", firstName: "Alice" },
      { email: "bob@example.com", firstName: "Bob" },
    ];

    const result = await deduplicateLeads("user_1", incoming);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("identifies a duplicate when email already exists in Firestore", async () => {
    const query = makeMockQuery(["alice@example.com"]);
    mockCollection.mockReturnValue(query as never);

    const incoming = [{ email: "alice@example.com" }, { email: "bob@example.com" }];
    const result = await deduplicateLeads("user_1", incoming);

    expect(result.unique).toHaveLength(1);
    expect(result.unique[0]?.email).toBe("bob@example.com");
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.email).toBe("alice@example.com");
  });

  it("is case-insensitive when comparing emails", async () => {
    const query = makeMockQuery(["alice@example.com"]);
    mockCollection.mockReturnValue(query as never);

    const incoming = [{ email: "ALICE@EXAMPLE.COM" }];
    const result = await deduplicateLeads("user_1", incoming);

    expect(result.duplicates).toHaveLength(1);
    expect(result.unique).toHaveLength(0);
  });

  it("treats leads without email as always unique", async () => {
    const query = makeMockQuery([]);
    mockCollection.mockReturnValue(query as never);

    const incoming = [
      { firstName: "Anonymous" }, // no email
      { email: "new@example.com" },
    ];
    const result = await deduplicateLeads("user_1", incoming);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("deduplicates within the incoming batch (same email twice)", async () => {
    const query = makeMockQuery([]);
    mockCollection.mockReturnValue(query as never);

    const incoming = [
      { email: "dup@example.com", firstName: "First" },
      { email: "dup@example.com", firstName: "Second" },
    ];
    const result = await deduplicateLeads("user_1", incoming);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("returns empty arrays for empty input", async () => {
    const result = await deduplicateLeads("user_1", []);
    expect(result.unique).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it("returns all as unique when all leads have no email", async () => {
    const result = await deduplicateLeads("user_1", [{ firstName: "A" }, { firstName: "B" }]);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });
});
