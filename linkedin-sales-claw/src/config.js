// Everything tunable, from env (launchd plist) with safe defaults.
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const list = (v, d) => (v ?? d).split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);

// Search recipes, run by CLICKING (search box -> People -> degree pills ->
// Locations). No URLs: the claw never loads a page (Cristiano 2026-10-15).
// Cold invites: 2nd + 3rd+ degree owners/founders in the US, by vertical.
const cold = (keywords) => ({ keywords, network: ['2nd', '3rd+'], location: 'United States' });
const DEFAULT_SEARCHES = [
  'owner marketing agency', 'founder agency', 'owner home services', 'owner construction company',
  'founder ecommerce brand', 'owner accounting firm', 'owner real estate brokerage', 'owner logistics company',
].map(cold);
// Cristiano's own 1st-degree connections, any location ("business owners in general").
const DEFAULT_EXISTING_SEARCHES = ['owner', 'founder', 'ceo', 'president', 'managing director', 'principal']
  .map((keywords) => ({ keywords, network: ['1st'] }));
const specs = (raw, fallback) => {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

// ⛔ Never message these, in any round (clients, partners, people Cristiano
// handles himself). Name match, case-insensitive, a listed name anywhere in
// theirs. Cristiano 2026-10-15: "don't message Jitka. Message other founders."
const DEFAULT_DO_NOT_MESSAGE = ['Jitka', 'Tyron Fandal', 'Ashley Coleman', 'Guy Riches', 'Mark Knesl', 'Denzel', 'Kareem', 'Chiamaka', 'Angus', 'Pavel', 'Rodney'];

export const config = () => ({
  root,
  statePath: process.env.CLAW_STATE || `${root}state/ledger.json`,
  cursorPath: `${root}state/search-cursor.json`,
  reportPath: `${root}state/last-report.json`,
  killSwitch: process.env.KILL_SWITCH === '1',
  searches: specs(process.env.LI_SEARCHES, DEFAULT_SEARCHES),
  exclude: list(process.env.LI_EXCLUDE, ''),
  // Cristiano 2026-10-15: "Don't remessage anybody." Follow-up knocks are OFF;
  // a person only hears from the claw again if they reply.
  followUps: process.env.LI_FOLLOWUPS === '1',
  doNotMessage: [...DEFAULT_DO_NOT_MESSAGE, ...list(process.env.LI_DO_NOT_MESSAGE, '')],
  existingSearches: specs(process.env.LI_EXISTING_SEARCHES, DEFAULT_EXISTING_SEARCHES),
  existingCursorPath: `${root}state/existing-cursor.json`,
  // Openers to people already connected, per rolling 24h. 0 turns it off.
  dailyExisting: Number(process.env.LI_DAILY_EXISTING ?? 20),
  // Flat daily invite cap; unset = the 5/10/18/20 weekly ramp in budget.js.
  dailyInvites: process.env.LI_DAILY_INVITES ? Number(process.env.LI_DAILY_INVITES) : null,
  // Messages WE send per rolling hour (openers + follow-ups + replies together).
  rate: { perHour: Number(process.env.MAX_MESSAGES_PER_HOUR ?? 6) },
  cdpPort: Number(process.env.LI_CDP_PORT ?? 9335),
  me: process.env.LI_ME || 'Cristiano Varriale',
  llmBackend: process.env.LLM_BACKEND || 'claude-cli',
  model: process.env.CLAW_MODEL || 'claude-sonnet-5-5',
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  claudeOauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN || (() => {
    try { return readFileSync(`${process.env.HOME}/.varritech/claude-oauth-token`, 'utf8').trim(); } catch { return undefined; }
  })(),
});
