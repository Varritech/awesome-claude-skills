/**
 * Tests for the Leads Gorilla HTTP client.
 *
 * HTTP fetch is mocked — we test the client's request construction and
 * response parsing, not the actual API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeadsGorillaClient } from "./client";

const mockFetch = vi.fn();

describe("LeadsGorillaClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("throws if no API key is provided and env var is unset", () => {
    const originalKey = process.env.LEADS_GORILLA_API_KEY;
    delete process.env.LEADS_GORILLA_API_KEY;
    expect(() => new LeadsGorillaClient()).toThrow(/LEADS_GORILLA_API_KEY/);
    if (originalKey) process.env.LEADS_GORILLA_API_KEY = originalKey;
  });

  it("accepts an API key via constructor options", () => {
    expect(() => new LeadsGorillaClient({ apiKey: "test_key" })).not.toThrow();
  });

  it("calls the correct endpoint with keyword and location params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ businesses: [] }),
    });

    const client = new LeadsGorillaClient({ apiKey: "test_key", baseUrl: "https://api.test.io" });
    await client.searchBusinesses({ keyword: "dentists", location: "Austin TX", limit: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/v1/search");
    expect(url).toContain("keyword=dentists");
    expect(url).toContain("location=Austin+TX");
    expect(url).toContain("limit=10");
  });

  it("sends Authorization Bearer header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ businesses: [] }),
    });

    const client = new LeadsGorillaClient({ apiKey: "my-key-123", baseUrl: "https://api.test.io" });
    await client.searchBusinesses({ keyword: "plumbers", location: "Miami FL" });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer my-key-123");
  });

  it("returns parsed businesses array", async () => {
    const mockBusinesses = [
      {
        name: "Joe Plumbing",
        email: "joe@plumbing.com",
        phone: "555-1234",
        address: "123 Main St",
        category: "Plumbers",
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ businesses: mockBusinesses }),
    });

    const client = new LeadsGorillaClient({ apiKey: "test", baseUrl: "https://api.test.io" });
    const result = await client.searchBusinesses({ keyword: "plumbers", location: "Miami" });

    expect(result.businesses).toHaveLength(1);
    expect(result.businesses[0]?.name).toBe("Joe Plumbing");
  });

  it("returns empty array when response has no businesses field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const client = new LeadsGorillaClient({ apiKey: "test", baseUrl: "https://api.test.io" });
    const result = await client.searchBusinesses({ keyword: "roofers", location: "Denver" });
    expect(result.businesses).toEqual([]);
  });

  it("throws on non-OK HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const client = new LeadsGorillaClient({ apiKey: "bad-key", baseUrl: "https://api.test.io" });
    await expect(client.searchBusinesses({ keyword: "test", location: "test" })).rejects.toThrow(
      "HTTP 401"
    );
  });

  it("defaults limit to 50 when not specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ businesses: [] }),
    });

    const client = new LeadsGorillaClient({ apiKey: "test", baseUrl: "https://api.test.io" });
    await client.searchBusinesses({ keyword: "lawyers", location: "NYC" });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("limit=50");
  });
});
