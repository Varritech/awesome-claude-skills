/**
 * Behavior tests for fetchUserLeads.
 *
 * Locks in the contract auto-draft relies on: ordering by createdAt desc,
 * optional status filter, soft-delete exclusion, and the limit being passed
 * through to Firestore so the customers list and auto-draft pull the same
 * first-N rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Record<string, unknown[]> = {};

vi.mock("@/lib/firebase/admin", () => {
  const docs = [
    { id: "ld_1", data: () => ({ id: "ld_1", userId: "u_1", status: "new", createdAt: "2026-06-04T00:00:00.000Z", deletedAt: null, source: "manual", tags: [] }) },
    { id: "ld_2", data: () => ({ id: "ld_2", userId: "u_1", status: "new", createdAt: "2026-06-03T00:00:00.000Z", deletedAt: null, source: "manual", tags: [] }) },
    { id: "ld_3", data: () => ({ id: "ld_3", userId: "u_1", status: "new", createdAt: "2026-06-02T00:00:00.000Z", deletedAt: "2026-06-04T00:00:00.000Z", source: "manual", tags: [] }) },
  ];

  const builder = {
    where: vi.fn((field: string, op: string, value: unknown) => {
      calls.where = calls.where ?? [];
      (calls.where as unknown[]).push({ field, op, value });
      return builder;
    }),
    orderBy: vi.fn((field: string, dir: string) => {
      calls.orderBy = [{ field, dir }];
      return builder;
    }),
    limit: vi.fn((n: number) => {
      calls.limit = [n];
      return builder;
    }),
    get: vi.fn(async () => ({ docs })),
  };

  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        calls.collection = [name];
        return builder;
      }),
    },
  };
});

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

import { fetchUserLeads } from "./fetch";

describe("fetchUserLeads", () => {
  it("queries leads collection ordered by createdAt desc with the requested limit", async () => {
    await fetchUserLeads("u_1", { limit: 20, status: "new" });

    expect(calls.collection).toEqual(["leads"]);
    expect(calls.orderBy).toEqual([{ field: "createdAt", dir: "desc" }]);
    expect(calls.limit).toEqual([20]);
    expect(calls.where).toEqual(
      expect.arrayContaining([
        { field: "userId", op: "==", value: "u_1" },
        { field: "status", op: "==", value: "new" },
      ]),
    );
  });

  it("drops soft-deleted leads from the returned set", async () => {
    const out = await fetchUserLeads("u_1", { limit: 20 });
    expect(out.map((l) => l.id)).toEqual(["ld_1", "ld_2"]);
  });

  it("omits the status filter when not provided", async () => {
    await fetchUserLeads("u_1", { limit: 5 });
    const statusClause = (calls.where as Array<{ field: string }>).find(
      (c) => c.field === "status",
    );
    expect(statusClause).toBeUndefined();
  });
});
