#!/usr/bin/env node
// node src/run.js [--dry] [--source github|apify|all] [--no-report]
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';
import { runGithub } from './github.js';
import { runApify } from './apify.js';
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
  const d = { createDb, runGithub, runApify, sendReport, ...deps };
  const args = parseArgs(argv);
  const now = new Date();
  const today = localDay(now);
  const dayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const db = d.createDb({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY });
  try { await db.ping(); } catch (e) { out(`ABORT: ${e.message}`); return 1; }

  const before = await db.countsSince(dayIso, monthIso);
  const runs = [];
  const record = async (row) => { runs.push(row); if (!args.dry) await db.logRun(row); };
  const log = (m) => out(m);

  if (args.source !== 'apify') {
    try {
      const r = await d.runGithub({ db, token: env.GITHUB_TOKEN, budget: Number(env.GITHUB_REPOS_PER_DAY || 800), today, dry: args.dry, log });
      await record({ source: 'github', scanned: r.scanned, found: r.found, kept: r.kept, spend_usd: 0, ok: true, notes: r.notes || '', data: { inserted: r.inserted, cursor: r.cursor } });
      out(`github: scanned ${r.scanned}, kept ${r.kept}, inserted ${r.inserted}`);
    } catch (e) {
      await record({ source: 'github', scanned: 0, found: 0, kept: 0, spend_usd: 0, ok: false, notes: String(e.message).slice(0, 300), data: {} });
      out(`github FAILED: ${e.message}`);
    }
  }
  if (args.source !== 'github') {
    const budgetUsd = Math.max(0, Math.round((Number(env.APIFY_DAILY_USD ?? 2) - before.spendToday) * 100) / 100);
    try {
      const r = await d.runApify({ db, token: env.APIFY_TOKEN, budgetUsd, today, dry: args.dry });
      if (!/^skipped/.test(r.notes)) await record({ source: 'apify_linkedin', scanned: r.scanned, found: r.found, kept: r.kept, spend_usd: r.spendUsd, ok: r.ok, notes: r.notes || '', data: { inserted: r.inserted, budgetUsd } });
      out(`apify: ${r.notes || `scanned ${r.scanned}, kept ${r.kept}, spend $${r.spendUsd}`}`);
    } catch (e) {
      await record({ source: 'apify_linkedin', scanned: 0, found: 0, kept: 0, spend_usd: 0, ok: false, notes: String(e.message).slice(0, 300), data: {} });
      out(`apify FAILED: ${e.message}`);
    }
  }

  if (!args.report) return 0;
  const counts = await db.countsSince(dayIso, monthIso);
  const msg = buildReport(counts, { today });
  out(`\n${msg.subject}\n${msg.text}`);
  if (args.dry) return 0;
  try {
    await d.sendReport({ apiKey: env.COMPOSIO_API_KEY, userId: env.COMPOSIO_USER_ID || 'claude_user', to: env.REPORT_TO || 'christian@varritech.com' }, msg);
  } catch (e) { out(`REPORT FAILED: ${e.message}`); return 1; }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
