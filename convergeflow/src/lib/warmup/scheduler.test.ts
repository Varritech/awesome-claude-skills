import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayQuota, isWarmedUp, warmupProgress, randomSendDelay } from "./scheduler";

const NOW = new Date("2026-05-12T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("todayQuota", () => {
  it("returns 0 when warmup disabled", () => {
    expect(
      todayQuota({
        warmupEnabled: false,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(0);
  });

  it("returns 0 when no warmupStartDate", () => {
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: null,
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(0);
  });

  it("returns 0 when status is not warming or active", () => {
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "connected",
      })
    ).toBe(0);
  });

  it("returns 0 when warmupStartDate is in the future", () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: future,
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(0);
  });

  it("returns WARMUP_BASE (5) on day 0 (same day as start)", () => {
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(5);
  });

  it("returns 8 on day 1 (start + 1 day)", () => {
    const start = new Date(NOW.getTime() - 86_400_000).toISOString();
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: start,
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(8);
  });

  it("caps at dailySendLimit", () => {
    // 5 + 30*3 = 95 > 50 → should cap at 50
    const start = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: start,
        dailySendLimit: 50,
        status: "active",
      })
    ).toBe(50);
  });

  it("works with status=active", () => {
    expect(
      todayQuota({
        warmupEnabled: true,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "active",
      })
    ).toBe(5);
  });
});

describe("isWarmedUp", () => {
  it("returns false when quota below limit", () => {
    expect(
      isWarmedUp({
        warmupEnabled: true,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(false);
  });

  it("returns true when quota reaches limit", () => {
    const start = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    expect(
      isWarmedUp({
        warmupEnabled: true,
        warmupStartDate: start,
        dailySendLimit: 50,
        status: "active",
      })
    ).toBe(true);
  });
});

describe("warmupProgress", () => {
  it("returns 0 when warmup not started", () => {
    expect(
      warmupProgress({
        warmupEnabled: false,
        warmupStartDate: null,
        dailySendLimit: 50,
        status: "connected",
      })
    ).toBe(0);
  });

  it("returns 10 on day 0 with limit 50 (5/50 = 10%)", () => {
    expect(
      warmupProgress({
        warmupEnabled: true,
        warmupStartDate: NOW.toISOString(),
        dailySendLimit: 50,
        status: "warming",
      })
    ).toBe(10);
  });

  it("returns 100 when fully warmed up", () => {
    const start = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    expect(
      warmupProgress({
        warmupEnabled: true,
        warmupStartDate: start,
        dailySendLimit: 50,
        status: "active",
      })
    ).toBe(100);
  });
});

describe("randomSendDelay", () => {
  it("returns a number within 0 and windowHours * 3_600_000", () => {
    for (let i = 0; i < 100; i++) {
      const d = randomSendDelay(8);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(8 * 3_600_000);
    }
  });

  it("respects custom window", () => {
    const d = randomSendDelay(2);
    expect(d).toBeLessThan(2 * 3_600_000);
  });
});
