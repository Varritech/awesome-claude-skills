/**
 * Unit tests for campaign-executor pacing logic.
 *
 * BUG DOCUMENTED: In campaign-executor.ts step 6, the send event timestamps are:
 *   ts: Date.now() + randomSendDelay(8) + i * 5_000
 *
 * randomSendDelay(8) = up to 8 hours * 3,600,000ms = up to 28,800,000ms delay.
 * This is applied to EVERY email including i=0 (the first one).
 * Result: first email is delayed up to 8 hours from campaign start.
 * This is correct for warmup purposes (spread across business hours) but
 * could push emails past the business window if campaign starts late in the day.
 *
 * The i*5_000 stagger (5s between emails) is correct.
 */

import { describe, it, expect, vi } from "vitest";
import { randomSendDelay } from "@/lib/warmup/scheduler";

describe("campaign send pacing", () => {
  it("randomSendDelay produces delays up to 8 hours for business-hour spread", () => {
    const MAX_DELAY = 8 * 3_600_000;
    for (let i = 0; i < 50; i++) {
      const d = randomSendDelay(8);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(MAX_DELAY);
    }
  });

  it("stagger spacing: 5 second gap between consecutive emails", () => {
    const emailCount = 5;
    const stagger = 5_000;
    const timestamps = Array.from({ length: emailCount }, (_, i) => i * stagger);
    // Each consecutive pair differs by exactly 5000ms
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]! - timestamps[i - 1]!).toBe(stagger);
    }
  });

  it("BUG: first email (i=0) gets the same random delay as others (may push past business hours)", () => {
    // Document: randomSendDelay is applied to i=0, meaning first email is NOT sent immediately.
    // For a campaign started at 5pm, delay up to 8h = sends at 1am (outside business hours).
    // Expected fix: clamp delay to remaining business hours, or start i=0 with 0 delay.
    vi.spyOn(Math, "random").mockReturnValue(0.99); // near-max delay
    const delay = randomSendDelay(8);
    expect(delay).toBeGreaterThan(7 * 3_600_000); // > 7 hours — could be after midnight
    vi.restoreAllMocks();
  });

  it("todayBatch correctly slices to quota", () => {
    const emailIds = ["em_1", "em_2", "em_3", "em_4", "em_5"];
    const quota = 3;
    const todayBatch = emailIds.slice(0, quota);
    expect(todayBatch).toHaveLength(3);
    expect(todayBatch).toEqual(["em_1", "em_2", "em_3"]);
  });

  it("todayBatch handles quota larger than email count", () => {
    const emailIds = ["em_1", "em_2"];
    const quota = 10;
    const todayBatch = emailIds.slice(0, quota);
    expect(todayBatch).toHaveLength(2); // clamped to available
  });
});

describe("send-email status guard", () => {
  /**
   * BUG: send-email.ts checks `emailDoc.status !== 'queued'` and skips if true.
   * But campaign-pause sets paused emails to status='paused'.
   * When campaign resumes, paused emails need to be reset to 'queued' before
   * email/send events are fired again. If they're fired with status='paused',
   * they will be skipped and never sent.
   *
   * No pause-resume flow currently resets status from 'paused' to 'queued'.
   */
  it("BUG: paused emails are skipped by send-email (status !== queued guard)", () => {
    const emailDoc = { status: "paused", id: "em_1", subject: "test", body: "body", userId: "u_1" };
    // Simulates the check in send-email.ts line 37
    const willSkip = emailDoc.status !== "queued";
    expect(willSkip).toBe(true); // paused emails get permanently skipped without a resume mechanism
  });

  it("queued emails pass the status guard", () => {
    const emailDoc = { status: "queued", id: "em_1", subject: "test", body: "body", userId: "u_1" };
    expect(emailDoc.status !== "queued").toBe(false);
  });
});
