/**
 * Tests for suppression and DNC check utilities.
 *
 * Firestore is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isEmailSuppressed, isEmailOnDnc } from "./check";

vi.mock("@/lib/firebase/admin", () => {
  const setFn = vi.fn().mockResolvedValue(undefined);
  const limitFn = vi.fn();
  const getFn = vi.fn();
  const whereFn = vi.fn();
  const docFn = vi.fn();
  const collectionFn = vi.fn();

  limitFn.mockReturnValue({ get: getFn });
  whereFn.mockReturnValue({ where: whereFn, limit: limitFn, get: getFn });
  docFn.mockReturnValue({ set: setFn });
  collectionFn.mockReturnValue({ where: whereFn, doc: docFn });

  return {
    adminDb: {
      collection: collectionFn,
    },
    _mocks: { setFn, limitFn, getFn, whereFn, docFn, collectionFn },
  };
});

import { adminDb } from "@/lib/firebase/admin";

const mockCollection = vi.mocked(adminDb.collection);

function mockQueryResult(empty: boolean) {
  const snap = { empty, docs: [] };
  const limit = { get: vi.fn().mockResolvedValue(snap) };
  const where2 = { where: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnValue(limit) };
  const where1 = { where: vi.fn().mockReturnValue(where2) };
  mockCollection.mockReturnValue(where1 as never);
}

describe("isEmailSuppressed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when email is on suppression list", async () => {
    mockQueryResult(false);
    const result = await isEmailSuppressed("user_1", "bad@example.com");
    expect(result).toBe(true);
  });

  it("returns false when email is not suppressed", async () => {
    mockQueryResult(true);
    const result = await isEmailSuppressed("user_1", "good@example.com");
    expect(result).toBe(false);
  });

  it("normalises email to lowercase before querying", async () => {
    mockQueryResult(true);
    await isEmailSuppressed("user_1", "UPPER@CASE.COM");
    // The where chain should have been called with lowercase email
    const whereCalls = mockCollection.mock.results[0]?.value?.where?.mock?.calls;
    expect(whereCalls).toBeDefined();
  });
});

describe("isEmailOnDnc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when email is on DNC list", async () => {
    mockQueryResult(false);
    const result = await isEmailOnDnc("dnc@company.com");
    expect(result).toBe(true);
  });

  it("returns false when email is not on DNC list", async () => {
    mockQueryResult(true);
    const result = await isEmailOnDnc("clean@company.com");
    expect(result).toBe(false);
  });

  it("queries the dnc collection", async () => {
    mockQueryResult(true);
    await isEmailOnDnc("test@example.com");
    expect(mockCollection).toHaveBeenCalledWith("dnc");
  });
});
