#!/usr/bin/env node
// node src/run.js [--dry] [--source github|apify|all] [--no-report]
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';
import { runGithub } from './github.js';
import { runApify } from './apify.js';
import { runSites } from './site.js';
import { creditUsage } from './firecrawl.js';
import { buildReport, sendReport } from './report.js';

export function parseArgs(argv) {
  const a = { dry: false, source: 'all', report: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry') a.dry = true;
    else if (argv[i] === '--no-report') a.report = false;
    else if (argv[i] === '--source') a.source = argv[++i];
  }
  if (!['github', 'apify', 'all'].includes(a.source)) throw new Error(`bad --source ${a.source}`);
  return a;
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function main({ argv = process.argv.slice(2), env = process.env, deps = {}, out = console.log } = {}) {
  const d = { createDb, runGithub, runApify, runSites, creditUsage, sendReport, ...deps };
  const args = parseArgs(argv);
  const now = new Date();
  const today = localDay(now);
  const dayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const db = d.createDb({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY });
  try { await db.ping(); } catch (e) {
    out(`ABORT: ${e.message}`);
    if (!args.dry && args.report && env.COMPOSIO_API_KEY) {
      const msg = { subject: `Lovable lead claw ${today}: ABORTED`, text: `Lovable lead claw, ${today}.\nNothing ran: ${e.message}\nNo leads were added and nothing was spent.` };
      try { await d.sendReport({ apiKey: env.COMPOSIO_API_KEY, userId: env.COMPOSIO_USER_ID || 'claude_user', to: env.REPORT_TO || 'christian@varritech.com' }, msg); } catch (re) { out(`REPORT FAILED: ${re.message}`); }
    }
    return 1;
  }

  const before = await db.countsSince(dayIso, monthIso);
  const runs = [];
  const lost = [];
  const record = async (row) => {
    runs.push(row);
    if (args.dry) return;
    for (let i = 1; ; i++) {
      try { await db.logRun(row); return; } catch (e) {
        if (i < 3) continue;
        // never drop the spend silently: print it and put it in the report
        if (row.spend_usd > 0) lost.push(row);
        out(`SPEND NOT RECORDED: ${row.source} $${Number(row.spend_usd).toFixed(2)} (${String(e.message).slice(0, 100)})`);
        return;
      }
    }
  };
  const log = (m) => out(m);

  const fcKey = env.FIRECRAWL_API_KEY;
  const fcCap = Number(env.FIRECRAWL_PAGES_PER_DAY || 0);
  const fcOn = !!fcKey && fcCap > 0;
  const pagesUsed = before.pagesToday || 0;
  const leadsTarget = Number(env.GITHUB_LEADS_PER_DAY || 1000);

  // Apify first: it needs <= 30 min, GitHub may sleep through hours of rate limit.
  if (args.source !== 'github') {
    const daily = Number(env.APIFY_DAILY_USD ?? 2) - before.spendToday;
    const lifetime = Number(env.APIFY_TOTAL_USD ?? 2) - (before.spendTotal ?? before.spendMonth);
    const budgetUsd = Math.max(0, Math.round(Math.min(daily, lifetime) * 100) / 100);
    try {
      const r = await d.runApify({ db, token: env.APIFY_TOKEN, budgetUsd, today, dry: args.dry, maxWaitMs: Number(env.APIFY_MAX_WAIT_MIN || 30) * 60 * 1000, itemsPerMin: Number(env.APIFY_ITEMS_PER_MIN || 10) });
      if (!/^skipped/.test(r.notes)) await record({ source: 'apify_linkedin', scanned: r.scanned, found: r.found, kept: r.kept, spend_usd: r.spendUsd, ok: r.ok, notes: r.notes || '', data: { inserted: r.inserted, budgetUsd } });
      out(`apify: ${r.notes || `scanned ${r.scanned}, kept ${r.kept}, spend $${r.spendUsd}`}`);
    } catch (e) {
      await record({ source: 'apify_linkedin', scanned: 0, found: 0, kept: 0, spend_usd: 0, ok: false, notes: String(e.message).slice(0, 300), data: {} });
      out(`apify FAILED: ${e.message}`);
    }
  }
  let candidates = [];
  if (args.source !== 'apify') {
    try {
      const r = await d.runGithub({ db, token: env.GITHUB_TOKEN, budget: args.dry ? Math.min(Number(env.GITHUB_REPOS_PER_DAY || 7000), Number(env.DRY_REPOS_PER_RUN || 300)) : Number(env.GITHUB_REPOS_PER_DAY || 7000), leadsTarget: Math.max(0, leadsTarget - before.newToday.github), candidateLimit: fcOn ? Math.floor(Math.max(0, fcCap - pagesUsed) / 2) : 0, maxRunMs: Number(env.GITHUB_MAX_RUN_HOURS || 18) * 3600 * 1000, today, dry: args.dry, log });
      candidates = r.candidates || [];
      await record({ source: 'github', scanned: r.scanned, found: r.found, kept: r.kept, spend_usd: 0, ok: true, notes: r.notes || '', data: { inserted: r.inserted, cursor: r.cursor } });
      out(`github: scanned ${r.scanned}, kept ${r.kept}, inserted ${r.inserted}`);
    } catch (e) {
      await record({ source: 'github', scanned: 0, found: 0, kept: 0, spend_usd: 0, ok: false, notes: String(e.message).slice(0, 300), data: {} });
      out(`github FAILED: ${e.message}`);
    }
    if (fcOn) {
      try {
        const r = await d.runSites({ db, apiKey: fcKey, cap: fcCap, usedToday: pagesUsed, today, dry: args.dry, candidates, log });
        await record({ source: 'firecrawl', scanned: r.pages, found: r.extra, kept: r.inserted, spend_usd: 0, ok: !r.error, notes: r.notes || '', data: { dead: r.dead, skipped: r.skipped, errors: r.errors, examined: r.examined, stopped: r.stopped, wouldScrape: r.wouldScrape } });
        out(`firecrawl: ${args.dry ? `dry, would scrape ${r.wouldScrape ?? 0}` : `scraped ${r.pages}`}, dead ${r.dead}, skipped ${r.skipped}, extra emails ${r.extra}, inserted ${r.inserted}${r.stopped ? `, stopped: ${r.stopped}` : ''}`);
      } catch (e) {
        await record({ source: 'firecrawl', scanned: 0, found: 0, kept: 0, spend_usd: 0, ok: false, notes: String(e.message).slice(0, 300), data: {} });
        out(`firecrawl FAILED: ${e.message}`);
      }
    }
  }

  if (!args.report) return 0;
  const counts = await db.countsSince(dayIso, monthIso);
  let creditsLeft = null;
  if (fcOn) { try { creditsLeft = await d.creditUsage({ apiKey: fcKey }); } catch { creditsLeft = null; } }
  const msg = buildReport(counts, { today, leadsTarget, firecrawl: fcOn ? { cap: fcCap, creditsLeft } : null });
  for (const r of lost) msg.text += `\nWARNING: ${r.source} spend of $${Number(r.spend_usd).toFixed(2)} was not recorded in the database. Add it by hand before the next run.`;
  out(`\n${msg.subject}\n${msg.text}`);
  if (args.dry) return 0;
  try {
    await d.sendReport({ apiKey: env.COMPOSIO_API_KEY, userId: env.COMPOSIO_USER_ID || 'claude_user', to: env.REPORT_TO || 'christian@varritech.com' }, msg);
  } catch (e) { out(`REPORT FAILED: ${e.message}`); return 1; }
  return lost.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
