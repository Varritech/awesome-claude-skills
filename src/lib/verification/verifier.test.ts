/**
 * Tests for email verification pipeline.
 *
 * DNS lookups are mocked — we test the logic, not actual DNS servers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyEmail } from "./verifier";

// Mock the dns/promises module
vi.mock("node:dns/promises", () => ({
  default: {
    resolveMx: vi.fn(),
  },
  resolveMx: vi.fn(),
}));

import dns from "node:dns/promises";

const mockResolveMx = vi.mocked(dns.resolveMx);

describe("verifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid: true when format is correct and MX records exist", async () => {
    mockResolveMx.mockResolvedValueOnce([{ exchange: "mail.google.com", priority: 10 }]);
    const result = await verifyEmail("test@gmail.com");
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns valid: false for invalid email format", async () => {
    const result = await verifyEmail("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid email format");
  });

  it("returns valid: false for empty string", async () => {
    const result = await verifyEmail("");
    expect(result.valid).toBe(false);
  });

  it("returns valid: false when MX records array is empty", async () => {
    mockResolveMx.mockResolvedValueOnce([]);
    const result = await verifyEmail("user@nodomain.io");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("No MX records");
  });

  it("returns valid: false when DNS lookup throws ENOTFOUND", async () => {
    const err = Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    mockResolveMx.mockRejectedValueOnce(err);
    const result = await verifyEmail("user@nonexistent.xyz");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("ENOTFOUND");
  });

  it("returns valid: false when DNS lookup throws ENODATA", async () => {
    const err = Object.assign(new Error("ENODATA"), { code: "ENODATA" });
    mockResolveMx.mockRejectedValueOnce(err);
    const result = await verifyEmail("user@noemail.example");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("ENODATA");
  });

  it("handles mixed-case email by lowercasing before checking", async () => {
    mockResolveMx.mockResolvedValueOnce([{ exchange: "mail.example.com", priority: 1 }]);
    const result = await verifyEmail("USER@EXAMPLE.COM");
    expect(result.valid).toBe(true);
    // Verify the domain passed to dns was lowercased
    expect(mockResolveMx).toHaveBeenCalledWith("example.com");
  });

  it("returns valid: false for null/undefined input", async () => {
    const result = await verifyEmail(null as unknown as string);
    expect(result.valid).toBe(false);
  });

  it("extracts the correct domain for the MX lookup", async () => {
    mockResolveMx.mockResolvedValueOnce([{ exchange: "mx.corp.co", priority: 5 }]);
    await verifyEmail("alice@corp.co");
    expect(mockResolveMx).toHaveBeenCalledWith("corp.co");
  });
});
