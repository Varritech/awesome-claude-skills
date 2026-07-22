/**
 * Warmup tick orchestrator — dependency-injected so it is unit-testable
 * without Firestore or nodemailer. The Inngest `warmup-tick` function is a
 * thin wrapper that wires real Firestore + the mailer senders into this.
 */

import { planWarmupTick, type TickEnv, type TickInbox } from "./tick-planner";
import type { OAuth2Config, SmtpConfig, SendOptions } from "@/lib/smtp/mailer";

export interface WarmupDeps {
  sendOauth2: (cfg: OAuth2Config, opts: SendOptions) => Promise<unknown>;
  sendSmtp: (cfg: SmtpConfig, opts: SendOptions) => Promise<unknown>;
  verifySmtp?: (cfg: SmtpConfig) => Promise<boolean>;
  writeInbox: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
}

export interface WarmupTickResult {
  action: "gmail" | "smtp" | "skip";
  reason?: string;
  warmupSent: number;
  quota: number;
  warmedUp: boolean;
  poolSize: number;
  backfilledStartDate?: string;
}

const WARMUP_SUBJECTS = [
  "Re: Following up",
  "Checking in",
  "Quick update",
  "Touching base",
  "Just wanted to share",
];

const WARMUP_BODIES = [
  "Thanks for reaching out. Looking forward to connecting.",
  "Got your message. Will get back to you shortly.",
  "Appreciate you following up. Let me check on this.",
  "Thanks for the note. Happy to chat when you have time.",
];

function smtpConfigFrom(inbox: TickInbox): SmtpConfig {
  return {
    host: inbox.smtpHost!,
    port: inbox.smtpPort ?? 587,
    user: inbox.smtpUser ?? inbox.email,
    encryptedPassword: inbox.smtpPasswordEncrypted!,
  };
}

/**
 * Runs a single warmup tick for one inbox. Performs the connecting→warming
 * transition (SMTP verify, or Gmail has no SMTP to verify), backfills a missing
 * warmupStartDate, sends today's quota of warmup emails, and flips to active
 * when the ramp reaches dailySendLimit.
 */
export async function executeWarmupTick(
  inbox: TickInbox,
  env: TickEnv & { WARMUP_POOL?: string },
  now: Date,
  pool: string[],
  deps: WarmupDeps,
): Promise<WarmupTickResult> {
  const iso = now.toISOString();
  let working: TickInbox = { ...inbox };

  // ── connecting → warming ───────────────────────────────────────────────────
  if (working.status === "connecting") {
    const isGmail =
      working.provider === "gmail" &&
      !!working.refreshToken &&
      !!env.GOOGLE_CLIENT_ID &&
      !!env.GOOGLE_CLIENT_SECRET;
    const isSmtp = !!working.smtpHost && !!working.smtpPasswordEncrypted;

    if (isGmail) {
      // Gmail has no SMTP to verify — OAuth already authorized via the callback.
      await deps.writeInbox(working.id, {
        status: "warming",
        warmupStartDate: iso,
        updatedAt: iso,
      });
      working = { ...working, status: "warming", warmupStartDate: iso };
    } else if (isSmtp && deps.verifySmtp) {
      const ok = await deps.verifySmtp(smtpConfigFrom(working));
      if (!ok) {
        await deps.writeInbox(working.id, { status: "error", updatedAt: iso });
        return { action: "skip", reason: "SMTP verification failed", warmupSent: 0, quota: 0, warmedUp: false, poolSize: pool.length };
      }
      await deps.writeInbox(working.id, {
        status: "warming",
        warmupStartDate: iso,
        updatedAt: iso,
      });
      working = { ...working, status: "warming", warmupStartDate: iso };
    }
  }

  // ── plan ───────────────────────────────────────────────────────────────────
  const plan = planWarmupTick(working, env, now);

  if (plan.warmupStartDateToSet) {
    await deps.writeInbox(working.id, {
      warmupStartDate: plan.warmupStartDateToSet,
      updatedAt: iso,
    });
    working = { ...working, warmupStartDate: plan.warmupStartDateToSet };
  }

  if (plan.action === "skip") {
    return {
      action: "skip",
      reason: plan.reason,
      warmupSent: 0,
      quota: plan.quota,
      warmedUp: plan.warmedUp,
      poolSize: pool.length,
      backfilledStartDate: plan.warmupStartDateToSet,
    };
  }

  if (plan.quota === 0) {
    await deps.writeInbox(working.id, { updatedAt: iso });
    return {
      action: plan.action,
      warmupSent: 0,
      quota: 0,
      warmedUp: plan.warmedUp,
      poolSize: pool.length,
      backfilledStartDate: plan.warmupStartDateToSet,
    };
  }

  // ── send warmup emails ────────────────────────────────────────────────────
  const warmupCount = Math.min(plan.quota, pool.length);
  const from = `${working.displayName ?? "ConvergeFlow"} <${working.email}>`;
  let warmupSent = 0;

  for (let i = 0; i < warmupCount; i++) {
    const to = pool[i];
    if (!to) break;
    const subject = WARMUP_SUBJECTS[i % WARMUP_SUBJECTS.length]!;
    const body = WARMUP_BODIES[i % WARMUP_BODIES.length]!;
    const opts: SendOptions = {
      from,
      to,
      subject,
      html: `<p>${body}</p>`,
      text: body,
      headers: { "X-Warmup": "1" },
    };
    try {
      if (plan.action === "gmail" && plan.oauth2Config) {
        await deps.sendOauth2(plan.oauth2Config, opts);
      } else if (plan.smtpConfig) {
        await deps.sendSmtp(plan.smtpConfig, opts);
      }
      warmupSent++;
    } catch {
      // best-effort per send; failures don't abort the tick
    }
  }

  // ── transition ────────────────────────────────────────────────────────────
  if (plan.warmedUp) {
    await deps.writeInbox(working.id, { status: "active", updatedAt: iso });
  } else {
    await deps.writeInbox(working.id, { updatedAt: iso });
  }

  return {
    action: plan.action,
    warmupSent,
    quota: plan.quota,
    warmedUp: plan.warmedUp,
    poolSize: pool.length,
    backfilledStartDate: plan.warmupStartDateToSet,
  };
}