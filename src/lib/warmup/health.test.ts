import { describe, it, expect } from "vitest";
import { warmupProgressPercent, statusBadge } from "./health";

const NOW = new Date("2026-07-21T08:00:00.000Z");
const DAY = 86_400_000;

describe("warmupProgressPercent (14-day target)", () => {
  it("returns 0 when there is no start date", () => {
    expect(warmupProgressPercent(null, NOW)).toBe(0);
  });

  it("returns 0 for an invalid start date", () => {
    expect(warmupProgressPercent("not-a-date", NOW)).toBe(0);
  });

  it("returns ~7 on day 1 (1/14 of the window)", () => {
    const start = new Date(NOW.getTime() - 1 * DAY).toISOString();
    expect(warmupProgressPercent(start, NOW)).toBe(7);
  });

  it("returns 100 at day 14 (window complete)", () => {
    const start = new Date(NOW.getTime() - 14 * DAY).toISOString();
    expect(warmupProgressPercent(start, NOW)).toBe(100);
  });

  it("caps at 100 beyond day 14", () => {
    const start = new Date(NOW.getTime() - 30 * DAY).toISOString();
    expect(warmupProgressPercent(start, NOW)).toBe(100);
  });

  it("returns 0 for a future start date", () => {
    const future = new Date(NOW.getTime() + DAY).toISOString();
    expect(warmupProgressPercent(future, NOW)).toBe(0);
  });
});

describe("statusBadge", () => {
  it("returns 'warming' for warming status", () => {
    expect(statusBadge("warming", 0)).toBe("warming");
  });

  it("returns 'healthy' for active status with low bounce rate", () => {
    expect(statusBadge("active", 0)).toBe("healthy");
  });

  it("returns 'error' for error status", () => {
    expect(statusBadge("error", 0)).toBe("error");
  });

  it("returns 'error' for disconnected status", () => {
    expect(statusBadge("disconnected", 0)).toBe("error");
  });

  it("returns 'warning' when bounce rate exceeds 10%", () => {
    expect(statusBadge("active", 0.2)).toBe("warning");
  });
});