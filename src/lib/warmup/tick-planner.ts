/**
 * Pure decision function for the daily inbox warmup tick.
 *
 * Given the inbox record + environment + current time, decides:
 *   - which send path to use (Gmail OAuth2 vs SMTP vs skip)
 *   - whether warmupStartDate needs backfilling (Gmail OAuth inboxes land at
 *     status 'warming' with no start date because the OAuth callback doesn't
 *     set one; the SMTP path sets it during its connecting→warming verify step)
 *   - today's send quota and whether the inbox has finished warming
 *
 * Kept pure (no Firestore / no nodemailer) so it is unit-testable. The Inngest
 * warmup-tick function performs the side effects implied by this plan.
 */

import { todayQuota, isWarmedUp, type WarmupState } from "./scheduler";
import type { OAuth2Config, SmtpConfig } from "@/lib/smtp/mailer";

export interface TickEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface TickInbox {
  id: string;
  provider: string;
  email: string;
  displayName?: string;
  status: string;
  warmupEnabled: boolean;
  warmupStartDate?: string | null;
  dailySendLimit: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
  refreshToken?: string;
  accessToken?: string;
}

export interface WarmupPlan {
  action: "gmail" | "smtp" | "skip";
  reason?: string;
  oauth2Config?: OAuth2Config;
  smtpConfig?: SmtpConfig;
  /** ISO date to write as warmupStartDate if it is missing, else undefined. */
  warmupStartDateToSet?: string;
  quota: number;
  warmedUp: boolean;
}

export function planWarmupTick(
  inbox: TickInbox,
  env: TickEnv,
  now: Date,
): WarmupPlan {
  const action = resolveAction(inbox, env);

  // Backfill: a warming inbox that never got a start date (Gmail OAuth case).
  const needsBackfill = inbox.status === "warming" && !inbox.warmupStartDate;
  const warmupStartDateToSet = needsBackfill ? now.toISOString() : undefined;

  // Quota is computed against the effective start date (backfilled for this tick
  // so progress advances immediately rather than waiting for the next tick).
  const effectiveStart = inbox.warmupStartDate ?? warmupStartDateToSet ?? null;
  const state: WarmupState = {
    warmupEnabled: inbox.warmupEnabled,
    warmupStartDate: effectiveStart,
    dailySendLimit: inbox.dailySendLimit,
    status: inbox.status,
  };
  const quota = todayQuota(state);
  const warmedUp = isWarmedUp(state);

  if (action.type === "skip") {
    return { action: "skip", reason: action.reason, quota, warmedUp };
  }

  const base: WarmupPlan = { action: action.type, quota, warmedUp };
  if (warmupStartDateToSet) base.warmupStartDateToSet = warmupStartDateToSet;

  if (action.type === "gmail") {
    base.oauth2Config = action.oauth2Config;
  } else {
    base.smtpConfig = action.smtpConfig;
  }
  return base;
}

type ResolvedAction =
  | { type: "gmail"; oauth2Config: OAuth2Config }
  | { type: "smtp"; smtpConfig: SmtpConfig }
  | { type: "skip"; reason: string };

function resolveAction(inbox: TickInbox, env: TickEnv): ResolvedAction {
  if (inbox.provider === "gmail") {
    if (!inbox.refreshToken || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return { type: "skip", reason: "No OAuth2 credentials" };
    }
    return {
      type: "gmail",
      oauth2Config: {
        user: inbox.email,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        refreshToken: inbox.refreshToken,
        ...(inbox.accessToken ? { accessToken: inbox.accessToken } : {}),
      },
    };
  }

  if (inbox.smtpHost && inbox.smtpPasswordEncrypted) {
    return {
      type: "smtp",
      smtpConfig: {
        host: inbox.smtpHost,
        port: inbox.smtpPort ?? 587,
        user: inbox.smtpUser ?? inbox.email,
        encryptedPassword: inbox.smtpPasswordEncrypted,
      },
    };
  }

  return { type: "skip", reason: "No SMTP credentials" };
}