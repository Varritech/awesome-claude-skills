// Secrets live in .env, which nothing was loading — `anthropicLlm` was being
// handed `x-api-key: undefined`, so the FIRST real run would have 401'd on every
// draft. Parsed by hand rather than via process.loadEnvFile(): that builtin
// silently no-opped here on node 25 (returned without throwing AND without
// setting anything), which is worse than failing. The key must never go in the
// launchd plist — the repo tracks a copy of it.
import { readFileSync } from 'node:fs';

function loadDotEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // no .env (CI, tests) — everything below has a default or is optional
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    // A real env var already set (launchd, shell) wins over the file — but an
    // EMPTY one does not. Cristiano's login shell exports ANTHROPIC_API_KEY=""
    // for zsh-ai, and an `!== undefined` check treated that as "already set",
    // silently keeping the key empty. Truthiness is the correct test here.
    if (process.env[key]) continue;
    process.env[key] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

loadDotEnv(new URL('../.env', import.meta.url).pathname);

/** A limit env var: unset falls back, 0/empty/"off" means no limit at all. */
function limitOrNull(raw, fallback) {
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const t = String(raw).trim().toLowerCase();
  if (t === '0' || t === 'off' || t === 'none' || t === 'unlimited') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = () => ({
  statePath: process.env.CLAW_STATE || new URL('../state/contacted.json', import.meta.url).pathname,
  valuePath: process.env.CLAW_VALUE || new URL('../state/value-library.json', import.meta.url).pathname,
  seenPath: process.env.CLAW_SEEN || new URL('../state/seen-notifications.json', import.meta.url).pathname,
  // Per RUN. Small on purpose: the claw polls every 5 min, so this is "how many
  // at once", not "how many per hour" — that is perHour/perDay below.
  cap: Number(process.env.RUN_CAP ?? process.env.HOURLY_CAP ?? 2),
  // Never cold-DM these, ever: own/personal/family accounts that engage with the
  // company posts. Comma-separated in CLAW_EXCLUDE.
  exclude: (process.env.CLAW_EXCLUDE ?? 'varriale.cristiano,jess_varriale,varritech')
    .split(',').map((h) => h.trim()).filter(Boolean),
  /*
   * ⛔ NO DAILY CAP by default (Cristiano, 2026-09-10: "there should not be any
   * daily window"). It hit 15/day and went silent for the rest of the day with
   * people still to reach.
   *
   * `0`, empty or absent means UNLIMITED — remainingBudget() reads null as
   * Infinity. A real number still caps, so one can be put back from env with no
   * code change. perHour stays as the pacing valve: it is what stops a burst
   * that looks like a bot to Instagram, and removing the DAILY ceiling does not
   * require removing the rate.
   */
  rate: {
    perHour: limitOrNull(process.env.MAX_PER_HOUR, 4),
    perDay: limitOrNull(process.env.MAX_PER_DAY, null),
  },
  // Days of silence before each follow-up, measured from the previous message.
  // Two entries = at most two follow-ups. Empty string turns follow-ups OFF.
  followUpDays: (process.env.FOLLOWUP_DAYS ?? '3,7')
    .split(',').map((d) => Number(d.trim())).filter((d) => Number.isFinite(d) && d > 0),
  killSwitch: process.env.KILL_SWITCH === '1',
  timeZone: process.env.CLAW_TZ || 'America/New_York',
  startHour: Number(process.env.START_HOUR ?? 0),
  endHour: Number(process.env.END_HOUR ?? 24),
  // Days the claw may send on, short names as Intl reports them (Mon..Sun).
  // Default is ALL SEVEN — set SEND_DAYS='Mon,Tue,Wed,Thu,Fri' to go back to
  // weekdays only. An empty/blank value falls back to the default rather than
  // silently making every day inert.
  sendDays: (process.env.SEND_DAYS ?? '').split(',').map((d) => d.trim()).filter(Boolean),
  llmBackend: process.env.LLM_BACKEND || 'claude-cli',
  // Same subscription account as every other claw. Read at startup, never copied.
  claudeOauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN || (() => {
    try { return readFileSync(`${process.env.HOME}/.varritech/claude-oauth-token`, 'utf8').trim(); } catch { return undefined; }
  })(),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  // Only set for identity-linked keys; workspace-scoped keys must omit it.
  anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
  // Instagram took link-sharing off @varritech 2026-08-28, ends 2026-09-27.
  // DMs still send; only URLs are barred. Flip to 0 (or delete) once it lapses.
  linksBlocked: process.env.LINKS_BLOCKED === '1',
  model: process.env.CLAW_MODEL || 'claude-sonnet-5',
  firestoreCollectionPrefix: process.env.FS_PREFIX || '',
  project: process.env.GOOGLE_CLOUD_PROJECT || 'varritech-dev',

  /*
   * The SMS concierge (src/sms-run.js). Separate ledger, separate caps, and
   * OFF unless SMS_ENABLED=1 — this half texts real phone numbers from the
   * number the whole business texts from, so it ships inert on purpose. There
   * is no default that starts it by accident.
   */
  sms: {
    enabled: process.env.SMS_ENABLED === '1',
    statePath: process.env.SMS_STATE || new URL('../state/sms-contacted.json', import.meta.url).pathname,
    apiKey: process.env.QUO_API_KEY,
    /*
     * ⛔ The CONVERSATION line, deliberately not the follow-up line.
     * +1 365 825 0303 sends the automated nurture touches (vds lib/quo-sms).
     * +1 332 279 5265 is where Cristiano's opener goes out and where replies
     * come back, so the sales claw owns one clean thread per lead. Sharing a
     * number would drop answers to "what are you building?" into the broadcast
     * thread, where nothing is listening.
     */
    from: process.env.QUO_FROM_NUMBER || '+13322795265',
    // Optional. Only needed if the account ever has more than one number.
    phoneNumberId: process.env.QUO_PHONE_NUMBER_ID,
    // The authenticated capture-row endpoint on varritech.com. A direct
    // Supabase connection would mean the service-role key lives on a laptop.
    leadsBaseUrl: process.env.SMS_LEADS_BASE_URL || 'https://www.varritech.com',
    leadsToken: process.env.SMS_LEADS_TOKEN,
    leadsDays: Number(process.env.SMS_LEADS_DAYS ?? 14),
    cap: Number(process.env.SMS_RUN_CAP ?? 5),
    rate: {
      perHour: Number(process.env.SMS_MAX_PER_HOUR ?? 8),
      perDay: Number(process.env.SMS_MAX_PER_DAY ?? 40),
    },
  },
});
