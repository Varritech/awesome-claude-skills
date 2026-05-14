import { describe, it, expect, vi } from "vitest";
import { CalendlyClient } from "./client";

describe("CalendlyClient", () => {
  it("throws when no API key is provided", () => {
    const originalKey = process.env.CALENDLY_API_KEY;
    delete process.env.CALENDLY_API_KEY;
    expect(() => new CalendlyClient()).toThrow("CALENDLY_API_KEY is not set");
    process.env.CALENDLY_API_KEY = originalKey;
  });

  it("accepts an API key directly in the constructor", () => {
    expect(() => new CalendlyClient("test-key")).not.toThrow();
  });

  describe("getSchedulingLink", () => {
    it("returns the provided calendlyUrl directly without an API call", async () => {
      const client = new CalendlyClient("test-key");
      const url = "https://calendly.com/myuser/30min";
      const result = await client.getSchedulingLink(url);
      expect(result).toBe(url);
    });

    it("fetches scheduling URL from Calendly API when no calendlyUrl is provided", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resource: {
              scheduling_url: "https://calendly.com/api-user/30min",
              uri: "https://api.calendly.com/users/abc",
            },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = new CalendlyClient("test-key");
      const result = await client.getSchedulingLink();
      expect(result).toBe("https://calendly.com/api-user/30min");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/me"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        })
      );

      vi.unstubAllGlobals();
    });

    it("throws when Calendly API returns a non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = new CalendlyClient("bad-key");
      await expect(client.getSchedulingLink()).rejects.toThrow("Calendly API error: 401");

      vi.unstubAllGlobals();
    });
  });
});
