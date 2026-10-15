#!/usr/bin/env node
// linkedin-sales-claw entry point.
//
//   node src/cli.js run [--dry]   one full run: preflight, replies, follow-ups, openers, invites
//   node src/cli.js ledger        who is where in the funnel
//   node src/cli.js handoffs      leads parked for Cristiano
//   node src/cli.js close <slug>  stop all automation for one lead (Cristiano took it over)
//
// --dry reads LinkedIn for real but replaces every send with a log line.

import { writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';
import { createLedger } from './ledger.js';
import { createLinkedInBrowser } from './browser.js';
import { inviteRound, acceptRound, followUpRound, replyRound, existingRound } from './pipeline.js';
import { claudeCliLlm, anthropicLlm } from './llm.js';
import { connectBudget, dailyConnectCap } from './budget.js';

const cfg = config();
const [cmd, ...args] = process.argv.slice(2);
const dry = args.includes('--dry');
// A dry run works on a throwaway copy, so it can "succeed" at every send and
// walk the exact path a live run would, without the real ledger ever moving.
const dryPath = `${cfg.statePath}.dry.json`;
if (dry) {
  rmSync(dryPath, { force: true });
  if (existsSync(cfg.statePath)) copyFileSync(cfg.statePath, dryPath);
}
const ledger = createLedger({ path: dry ? dryPath : cfg.statePath });

function fileCursor(path) {
  return {
    get: () => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return { search: 0, page: 1 }; } },
    set: (c) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(c)); },
  };
}

const makeLlm = () => (cfg.llmBackend === 'anthropic-api'
  ? anthropicLlm({ apiKey: cfg.anthropicKey, model: cfg.model })
  : claudeCliLlm({ model: cfg.model, oauthToken: cfg.claudeOauthToken }));

function dryWrap(browser) {
  const would = [];
  return {
    ...browser,
    would,
    sendInvite: async (slug, { note } = {}) => { would.push({ invite: slug, note }); return { ok: true, noted: true }; },
    sendMessage: async ({ slug, text }) => { would.push({ message: slug, text }); return true; },
  };
}

async function run() {
  if (cfg.killSwitch && !dry) { console.log(JSON.stringify({ killed: true })); return; }
  const now = new Date();
  let browser = createLinkedInBrowser({ cdpPort: cfg.cdpPort, me: cfg.me });
  if (dry) browser = dryWrap(browser);
  const report = { at: now.toISOString(), dry, connectBudget: connectBudget({ ledger, now, dailyCap: cfg.dailyInvites }), dailyCap: cfg.dailyInvites ?? dailyConnectCap({ ledger, now }) };
  report.preflight = await browser.preflight();
  // Replies first: a person mid-conversation outranks everything else.
  report.replies = await replyRound({ ledger, browser, llm: makeLlm(), now, rate: cfg.rate });
  report.followUps = await followUpRound({ ledger, browser, now, rate: cfg.rate });
  report.openers = await acceptRound({ ledger, browser, now, rate: cfg.rate });
  report.existing = await existingRound({ ledger, browser, now, rate: cfg.rate, searches: cfg.existingSearches, cursor: fileCursor(dry ? `${cfg.existingCursorPath}.dry` : cfg.existingCursorPath), dailyCap: cfg.dailyExisting });
  report.invites = await inviteRound({ ledger, browser, now, searches: cfg.searches, exclude: cfg.exclude, dailyCap: cfg.dailyInvites });
  if (dry) report.wouldSend = browser.would;
  mkdirSync(dirname(cfg.reportPath), { recursive: true });
  writeFileSync(cfg.reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const errors = ['replies', 'followUps', 'openers', 'existing', 'invites'].map((k) => report[k]?.error).filter(Boolean);
  if (errors.length) { console.error(`ERRORS: ${errors.join(' | ')}`); process.exitCode = 1; }
}

if (cmd === 'run') {
  await run();
} else if (cmd === 'ledger') {
  const rows = ledger.all();
  console.log(`${rows.length} in ledger, connect budget left today: ${connectBudget({ ledger })}/${dailyConnectCap({ ledger })}`);
  for (const e of rows) {
    const n = (e.messages ?? []).length;
    const state = e.status === 'skipped' ? `skipped:${e.reason}`
      : e.closed ? 'CLOSED (Cristiano)' : e.handoff ? `HANDOFF: ${e.handoffReason}`
      : e.qualified ? 'QUALIFIED' : e.replied ? 'REPLIED' : n ? `${n} msg` : e.acceptedAt ? 'accepted' : 'invited';
    console.log(`  ${String(e.slug).padEnd(32)} ${String(e.name ?? '').padEnd(24)} ${state}`);
  }
} else if (cmd === 'handoffs') {
  for (const e of ledger.all().filter((x) => x.handoff && !x.closed)) {
    console.log(`${e.slug}  ${e.name}  ${e.handoffAt}  ${e.handoffReason}\n  last: ${e.messages?.at(-1)?.text ?? ''}`);
  }
} else if (cmd === 'close') {
  ledger.setStage(args[0], { closed: true });
  console.log(`closed: ${args[0]}`);
} else {
  console.error('usage: cli.js run [--dry] | ledger | handoffs | close <slug>');
  process.exit(1);
}
