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

export const config = () => ({
  statePath: process.env.CLAW_STATE || new URL('../state/contacted.json', import.meta.url).pathname,
  seenPath: process.env.CLAW_SEEN || new URL('../state/seen-notifications.json', import.meta.url).pathname,
  // Per RUN. Small on purpose: the claw polls every 5 min, so this is "how many
  // at once", not "how many per hour" — that is perHour/perDay below.
  cap: Number(process.env.RUN_CAP ?? process.env.HOURLY_CAP ?? 2),
  // Never cold-DM these, ever: own/personal/family accounts that engage with the
  // company posts. Comma-separated in CLAW_EXCLUDE.
  exclude: (process.env.CLAW_EXCLUDE ?? 'varriale.cristiano,jess_varriale,varritech')
    .split(',').map((h) => h.trim()).filter(Boolean),
  rate: {
    perHour: Number(process.env.MAX_PER_HOUR ?? 4),
    perDay: Number(process.env.MAX_PER_DAY ?? 15),
  },
  // Days of silence before each follow-up, measured from the previous message.
  // Two entries = at most two follow-ups. Empty string turns follow-ups OFF.
  followUpDays: (process.env.FOLLOWUP_DAYS ?? '3,7')
    .split(',').map((d) => Number(d.trim())).filter((d) => Number.isFinite(d) && d > 0),
  killSwitch: process.env.KILL_SWITCH === '1',
  timeZone: process.env.CLAW_TZ || 'America/New_York',
  startHour: Number(process.env.START_HOUR ?? 9),
  endHour: Number(process.env.END_HOUR ?? 20),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.CLAW_MODEL || 'claude-sonnet-5',
  firestoreCollectionPrefix: process.env.FS_PREFIX || '',
  project: process.env.GOOGLE_CLOUD_PROJECT || 'varritech-dev',
});
