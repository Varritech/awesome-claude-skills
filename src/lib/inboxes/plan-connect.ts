/**
 * Pure decision helper for connecting an inbox.
 *
 * Decides the post-connect status + warmup flags from the connect payload —
 * extracted from the route so the skip-warmup behavior is unit-testable.
 *
 * skipWarmup: the inbox goes straight to `active` with warmup disabled, so the
 * user can send to real customers immediately (no 14-day ramp). The daily cron
 * only ticks inboxes in `connecting`/`warming`, so an `active` inbox is never
 * warmup-ticked.
 */

export interface InboxConnectPlan {
  status: "connecting" | "warming" | "active";
  warmupEnabled: boolean;
  warmupStartDate: string | null;
}

export function planInboxConnect(
  payload: { skipWarmup?: boolean; hasSmtp: boolean },
  now: Date,
): InboxConnectPlan {
  if (payload.skipWarmup) {
    return {
      status: "active",
      warmupEnabled: false,
      warmupStartDate: now.toISOString(),
    };
  }
  if (payload.hasSmtp) {
    // SMTP creds present (Gmail OAuth or own SMTP) → kick off warmup immediately.
    return {
      status: "warming",
      warmupEnabled: true,
      warmupStartDate: now.toISOString(),
    };
  }
  return {
    status: "connecting",
    warmupEnabled: true,
    warmupStartDate: null,
  };
}