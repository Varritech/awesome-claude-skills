import { describe, it, expect, vi } from "vitest";
import { executeWarmupTick, type WarmupDeps } from "./tick-executor";

const NOW = new Date("2026-07-21T08:00:00.000Z");
const ENV = {
  GOOGLE_CLIENT_ID: "cid",
  GOOGLE_CLIENT_SECRET: "csec",
  WARMUP_POOL: "warm-a@example.com,warm-b@example.com",
};

const gmailWarming = (overrides: Record<string, unknown> = {}) => ({
  id: "ib_1",
  provider: "gmail",
  email: "christian@christianvarriale.com",
  displayName: "Christian",
  status: "warming",
  warmupEnabled: true,
  warmupStartDate: null as string | null,
  dailySendLimit: 50,
  refreshToken: "rt",
  ...overrides,
});

function makeDeps(): WarmupDeps & {
  sendOauth2: ReturnType<typeof vi.fn>;
  sendSmtp: ReturnType<typeof vi.fn>;
  verifySmtp: ReturnType<typeof vi.fn>;
  writeInbox: ReturnType<typeof vi.fn>;
  logWarmupSend: ReturnType<typeof vi.fn>;
  incrementWarmupSent: ReturnType<typeof vi.fn>;
} {
  return {
    sendOauth2: vi.fn().mockResolvedValue({ messageId: "m", accepted: ["x"], rejected: [] }),
    sendSmtp: vi.fn().mockResolvedValue({ messageId: "m", accepted: ["x"], rejected: [] }),
    verifySmtp: vi.fn().mockResolvedValue(true),
    writeInbox: vi.fn().mockResolvedValue(undefined),
    logWarmupSend: vi.fn().mockResolvedValue(undefined),
    incrementWarmupSent: vi.fn().mockResolvedValue(undefined),
  };
}

function pool(env: { WARMUP_POOL?: string }) {
  return (env.WARMUP_POOL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

describe("executeWarmupTick — Gmail OAuth path", () => {
  it("sends warmup emails via the OAuth2 path (sendOauth2, not sendSmtp)", async () => {
    const deps = makeDeps();
    const result = await executeWarmupTick(
      gmailWarming() as never,
      ENV as never,
      NOW,
      pool(ENV),
      deps,
    );

    expect(result.action).toBe("gmail");
    expect(deps.sendOauth2).toHaveBeenCalled();
    expect(deps.sendSmtp).not.toHaveBeenCalled();
    // day-0 quota = 8, pool size = 2 → min(8, 2) = 2 sends
    expect(deps.sendOauth2).toHaveBeenCalledTimes(2);
    expect(result.warmupSent).toBe(2);
  });

  it("logs each warmup send + increments the warmupSent counter (visibility)", async () => {
    const deps = makeDeps();
    const result = await executeWarmupTick(
      gmailWarming() as never,
      ENV as never,
      NOW,
      pool(ENV),
      deps,
    );

    // 2 sends → 2 log entries + 2 counter increments
    expect(result.warmupSent).toBe(2);
    expect(deps.logWarmupSend).toHaveBeenCalledTimes(2);
    expect(deps.incrementWarmupSent).toHaveBeenCalledTimes(2);
    // each log entry carries the pool recipient + subject + timestamp
    const firstEntry = deps.logWarmupSend.mock.calls[0]![1] as {
      to: string;
      subject: string;
      sentAt: string;
    };
    expect(firstEntry.to).toMatch(/@example\.com$/);
    expect(firstEntry.subject).toBeTruthy();
    expect(firstEntry.sentAt).toBe(NOW.toISOString());
  });

  it("backfills warmupStartDate when missing (writes it once)", async () => {
    const deps = makeDeps();
    await executeWarmupTick(gmailWarming() as never, ENV as never, NOW, pool(ENV), deps);

    const backfillCall = deps.writeInbox.mock.calls.find((c) =>
      Object.keys(c[1] as Record<string, unknown>).includes("warmupStartDate"),
    );
    expect(backfillCall).toBeTruthy();
    expect((backfillCall![1] as Record<string, unknown>).warmupStartDate).toBe(
      NOW.toISOString(),
    );
  });
});

describe("executeWarmupTick — empty warmup pool", () => {
  it("skips sends but still backfills start date + advances state", async () => {
    const deps = makeDeps();
    const result = await executeWarmupTick(
      gmailWarming() as never,
      { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec", WARMUP_POOL: "" } as never,
      NOW,
      pool({ WARMUP_POOL: "" }),
      deps,
    );

    expect(result.action).toBe("gmail");
    expect(deps.sendOauth2).not.toHaveBeenCalled();
    expect(result.warmupSent).toBe(0);
    // start date still backfilled so progress advances
    const backfillCall = deps.writeInbox.mock.calls.find((c) =>
      Object.keys(c[1] as Record<string, unknown>).includes("warmupStartDate"),
    );
    expect(backfillCall).toBeTruthy();
  });
});

describe("executeWarmupTick — SMTP path", () => {
  const smtpWarming = (overrides: Record<string, unknown> = {}) => ({
    id: "ib_2",
    provider: "smtp_imap",
    email: "chris@reach.convergeflow.io",
    displayName: "Chris",
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

  it("sends via SMTP, not OAuth2", async () => {
    const deps = makeDeps();
    const result = await executeWarmupTick(
      smtpWarming() as never,
      ENV as never,
      NOW,
      pool(ENV),
      deps,
    );
    expect(result.action).toBe("smtp");
    expect(deps.sendSmtp).toHaveBeenCalled();
    expect(deps.sendOauth2).not.toHaveBeenCalled();
  });
});

describe("executeWarmupTick — warmedUp transition", () => {
  it("marks the inbox active when quota reaches dailySendLimit at day 14", async () => {
    const start = new Date(NOW.getTime() - 14 * 86_400_000).toISOString();
    const deps = makeDeps();
    const result = await executeWarmupTick(
      gmailWarming({ warmupStartDate: start }) as never,
      ENV as never,
      NOW,
      pool(ENV),
      deps,
    );

    expect(result.warmedUp).toBe(true);
    const activeCall = deps.writeInbox.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).status === "active",
    );
    expect(activeCall).toBeTruthy();
  });
});