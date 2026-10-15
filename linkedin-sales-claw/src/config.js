// Everything tunable, from env (launchd plist) with safe defaults.
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const list = (v, d) => (v ?? d).split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);

// US (geoUrn 103644278), 2nd + 3rd+ degree, people search. Owner/founder
// keywords per vertical; matchesIcp() still filters every headline.
const people = (kw) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}&geoUrn=%5B%22103644278%22%5D&network=%5B%22S%22%2C%22O%22%5D`;
const DEFAULT_SEARCHES = [
  people('owner marketing agency'),
  people('founder agency'),
  people('owner home services'),
  people('owner construction company'),
  people('founder ecommerce brand'),
  people('owner accounting firm'),
  people('owner real estate brokerage'),
  people('owner logistics company'),
].join(' | ');

export const config = () => ({
  root,
  statePath: process.env.CLAW_STATE || `${root}state/ledger.json`,
  cursorPath: `${root}state/search-cursor.json`,
  reportPath: `${root}state/last-report.json`,
  killSwitch: process.env.KILL_SWITCH === '1',
  searches: list(process.env.LI_SEARCHES, DEFAULT_SEARCHES),
  exclude: list(process.env.LI_EXCLUDE, ''),
  // Flat daily invite cap; unset = the 5/10/18/20 weekly ramp in budget.js.
  dailyInvites: process.env.LI_DAILY_INVITES ? Number(process.env.LI_DAILY_INVITES) : null,
  // Messages WE send per rolling hour (openers + follow-ups + replies together).
  rate: { perHour: Number(process.env.MAX_MESSAGES_PER_HOUR ?? 6) },
  mcpUrl: process.env.LI_MCP_URL || 'http://127.0.0.1:3005/mcp',
  cdpPort: Number(process.env.LI_CDP_PORT ?? 9335),
  me: process.env.LI_ME || 'Cristiano Varriale',
  llmBackend: process.env.LLM_BACKEND || 'claude-cli',
  model: process.env.CLAW_MODEL || 'claude-sonnet-5-5',
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  claudeOauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN || (() => {
    try { return readFileSync(`${process.env.HOME}/.varritech/claude-oauth-token`, 'utf8').trim(); } catch { return undefined; }
  })(),
});
