import { describe, it, expect } from "vitest";
import { planWarmupTick } from "./tick-planner";

const NOW = new Date("2026-07-21T08:00:00.000Z");
const ENV = { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec" };

const gmailInbox = (overrides: Record<string, unknown> = {}) => ({
  id: "ib_1",
  provider: "gmail",
  email: "christian@christianvarriale.com",
  status: "warming",
  warmupEnabled: true,
  warmupStartDate: null as string | null,
  dailySendLimit: 50,
  refreshToken: "refresh-token-xyz",
  displayName: "Christian",
  ...overrides,
});

const smtpInbox = (overrides: Record<string, unknown> = {}) => ({
  id: "ib_2",
  provider: "smtp_imap",
  email: "chris@reach.convergeflow.io",
  status: "warming",
  warmupEnabled: true,
  warmupStartDate: NOW.toISOString(),
  dailySendLimit: 50,
  smtpHost: "smtp.mailforge.com",
  smtpPort: 587,
  smtpUser: "chris@reach.convergeflow.io",
  smtpPasswordEncrypted: "enc",
  ...overrides,
});

describe("planWarmupTick — Gmail OAuth2 path", () => {
  it("uses the gmail OAuth2 path when provider is gmail and refreshToken is present", () => {
    const plan = planWarmupTick(gmailInbox() as never, ENV, NOW);
    expect(plan.action).toBe("gmail");
    expect(plan.oauth2Config).toEqual(
      expect.objectContaining({
        user: "christian@christianvarriale.com",
        clientId: "cid",
        clientSecret: "csec",
        refreshToken: "refresh-token-xyz",
      }),
    );
  });

  it("skips a gmail inbox that has no refreshToken", () => {
    const plan = planWarmupTick(gmailInbox({ refreshToken: undefined }) as never, ENV, NOW);
    expect(plan.action).toBe("skip");
    expect(plan.reason).toMatch(/oauth2 credentials/i);
  });

  it("skips a gmail inbox when GOOGLE_CLIENT_ID/SECRET env is missing", () => {
    const plan = planWarmupTick(gmailInbox() as never, {}, NOW);
    expect(plan.action).toBe("skip");
  });
});

describe("planWarmupTick — SMTP path", () => {
  it("uses the SMTP path when smtpHost + smtpPasswordEncrypted are present", () => {
    const plan = planWarmupTick(smtpInbox() as never, ENV, NOW);
    expect(plan.action).toBe("smtp");
    expect(plan.smtpConfig).toEqual(
      expect.objectContaining({
        host: "smtp.mailforge.com",
        port: 587,
        user: "chris@reach.convergeflow.io",
        encryptedPassword: "enc",
      }),
    );
  });

  it("skips an SMTP inbox missing smtpHost or password", () => {
    const plan = planWarmupTick(smtpInbox({ smtpHost: undefined }) as never, ENV, NOW);
    expect(plan.action).toBe("skip");
  });

  it("does not use the gmail path for an SMTP inbox even if it has a refreshToken", () => {
    const plan = planWarmupTick(
      smtpInbox({ refreshToken: "rt" }) as never,
      ENV,
      NOW,
    );
    expect(plan.action).toBe("smtp");
  });
});

describe("planWarmupTick — warmupStartDate backfill", () => {
  it("backfills warmupStartDate when status is warming and it is missing", () => {
    const plan = planWarmupTick(gmailInbox({ warmupStartDate: null }) as never, ENV, NOW);
    expect(plan.warmupStartDateToSet).toBe(NOW.toISOString());
  });

  it("does not overwrite an existing warmupStartDate", () => {
    const existing = new Date(NOW.getTime() - 3 * 86_400_000).toISOString();
    const plan = planWarmupTick(gmailInbox({ warmupStartDate: existing }) as never, ENV, NOW);
    expect(plan.warmupStartDateToSet).toBeUndefined();
  });

  it("uses the backfilled start date to compute quota so progress advances on the first tick", () => {
    const plan = planWarmupTick(gmailInbox({ warmupStartDate: null }) as never, ENV, NOW);
    expect(plan.quota).toBe(8); // day 0 = WARMUP_BASE
  });
});

describe("planWarmupTick — warmedUp transition", () => {
  it("flags warmedUp when quota reaches dailySendLimit at day 14", () => {
    const start = new Date(NOW.getTime() - 14 * 86_400_000).toISOString();
    const plan = planWarmupTick(
      gmailInbox({ warmupStartDate: start, status: "warming" }) as never,
      ENV,
      NOW,
    );
    expect(plan.quota).toBe(50);
    expect(plan.warmedUp).toBe(true);
  });

  it("does not flag warmedUp mid-ramp", () => {
    const start = new Date(NOW.getTime() - 5 * 86_400_000).toISOString();
    const plan = planWarmupTick(
      gmailInbox({ warmupStartDate: start, status: "warming" }) as never,
      ENV,
      NOW,
    );
    expect(plan.warmedUp).toBe(false);
  });
});