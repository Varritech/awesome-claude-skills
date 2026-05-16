/**
 * Tests for the in-memory sliding-window rate limiter.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit, clearAllRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", () => {
    const result = checkRateLimit("user_1", "search", 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("tracks remaining count correctly", () => {
    const limit = 5;
    let last;
    for (let i = 0; i < limit - 1; i++) {
      last = checkRateLimit("user_1", "search", limit, 60_000);
    }
    expect(last?.remaining).toBe(1);
  });

  it("blocks when limit is exceeded", () => {
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, 60_000);
    }
    const result = checkRateLimit("user_1", "search", limit, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns a positive retryAfterSeconds when blocked", () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, 60_000);
    }
    const result = checkRateLimit("user_1", "search", limit, 60_000);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates counters per user", () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, 60_000);
    }
    // user_2 should still be allowed
    const result = checkRateLimit("user_2", "search", limit, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("isolates counters per action", () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, 60_000);
    }
    // Different action for same user should be allowed
    const result = checkRateLimit("user_1", "other-action", limit, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("resets counter after window expires", () => {
    vi.useFakeTimers();
    const limit = 2;
    const windowMs = 1_000;

    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, windowMs);
    }

    // Advance time past window
    vi.advanceTimersByTime(windowMs + 100);

    const result = checkRateLimit("user_1", "search", limit, windowMs);
    expect(result.allowed).toBe(true);
  });

  it("resetRateLimit clears counter for a specific user+action", () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      checkRateLimit("user_1", "search", limit, 60_000);
    }
    // Should be blocked
    expect(checkRateLimit("user_1", "search", limit, 60_000).allowed).toBe(false);

    resetRateLimit("user_1", "search");

    // Should be allowed again
    expect(checkRateLimit("user_1", "search", limit, 60_000).allowed).toBe(true);
  });

  it("returning remaining is 0 when allowed is false", () => {
    const limit = 1;
    checkRateLimit("user_1", "search", limit, 60_000); // use up limit
    const result = checkRateLimit("user_1", "search", limit, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
