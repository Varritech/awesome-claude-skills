import { describe, it, expect } from "vitest";
import { planInboxConnect } from "./plan-connect";

const NOW = new Date("2026-07-22T00:00:00.000Z");

describe("planInboxConnect", () => {
  it("defaults to connecting + warmupEnabled when no SMTP + skipWarmup omitted", () => {
    expect(planInboxConnect({ hasSmtp: false }, NOW)).toEqual({
      status: "connecting",
      warmupEnabled: true,
      warmupStartDate: null,
    });
  });

  it("starts warming immediately when SMTP creds are present", () => {
    expect(planInboxConnect({ hasSmtp: true }, NOW)).toEqual({
      status: "warming",
      warmupEnabled: true,
      warmupStartDate: NOW.toISOString(),
    });
  });

  it("skips warmup when skipWarmup is true: active + warmupDisabled + start date now", () => {
    expect(planInboxConnect({ skipWarmup: true, hasSmtp: false }, NOW)).toEqual({
      status: "active",
      warmupEnabled: false,
      warmupStartDate: NOW.toISOString(),
    });
  });

  it("skipWarmup overrides the SMTP-present warming path", () => {
    expect(planInboxConnect({ skipWarmup: true, hasSmtp: true }, NOW)).toEqual({
      status: "active",
      warmupEnabled: false,
      warmupStartDate: NOW.toISOString(),
    });
  });
});