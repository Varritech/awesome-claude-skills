import test from 'node:test';
import assert from 'node:assert/strict';
import { main, parseArgs } from '../src/run.js';

const ENV = { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k', GITHUB_TOKEN: 'g', APIFY_TOKEN: 'a', COMPOSIO_API_KEY: 'c', APIFY_DAILY_USD: '2.00', GITHUB_REPOS_PER_DAY: '50' };
const COUNTS = { spendTotal: 0.5, total: 1, unsent: 1, bySource: {}, newToday: { github: 1, apify_linkedin: 0 }, spendToday: 0.5, spendMonth: 0.5, githubScanned: 1, githubScannedTotal: 1, errors: [] };

function deps(over = {}) {
  const calls = { runs: [], mail: [], github: [], apify: [], pings: 0 };
  const db = {
    ping: async () => { calls.pings++; }, logRun: async (r) => { calls.runs.push(r); },
    countsSince: async () => COUNTS,
  };
  return {
    calls,
    deps: {
      createDb: () => db,
      runGithub: async (o) => { calls.github.push(o); return { scanned: 3, found: 2, kept: 2, inserted: 2, notes: '' }; },
      runApify: async (o) => { calls.apify.push(o); return { scanned: 4, found: 2, kept: 2, inserted: 2, spendUsd: 0.4, ok: true, notes: '' }; },
      sendReport: async (c, m) => { calls.mail.push({ c, m }); },
      ...over,
    },
  };
}
const go = (argv, env, d) => { const out = []; return main({ argv, env, deps: d.deps, out: (s) => out.push(s) }).then((code) => ({ code, out: out.join('\n') })); };

test('parseArgs', () => {
  assert.deepEqual(parseArgs(['--dry', '--source', 'github', '--no-report']), { dry: true, source: 'github', report: false });
  assert.deepEqual(parseArgs([]), { dry: false, source: 'all', report: true });
});

test('aborts without running any source when the DB is unreachable', async () => {
  const d = deps({ createDb: () => ({ ping: async () => { throw new Error('Supabase unreachable'); } }) });
  const r = await go([], ENV, d);
  assert.equal(r.code, 1);
  assert.equal(d.calls.github.length + d.calls.apify.length, 0);
});

test('full run: both sources, runs logged, report emailed and printed, apify budget = daily minus spent today', async () => {
  const d = deps();
  const r = await go([], ENV, d);
  assert.equal(r.code, 0);
  assert.equal(d.calls.github[0].budget, 50); assert.equal(d.calls.github[0].dry, false);
  assert.equal(d.calls.apify[0].budgetUsd, 1.5);
  assert.deepEqual(d.calls.runs.map((x) => x.source).sort(), ['apify_linkedin', 'github']);
  assert.equal(d.calls.runs.find((x) => x.source === 'apify_linkedin').spend_usd, 0.4);
  assert.equal(d.calls.mail.length, 1);
  assert.match(r.out, /Lovable lead claw/);
});

test('dry run: no logRun, no email, apify skipped but github still scans', async () => {
  const d = deps();
  const r = await go(['--dry'], ENV, d);
  assert.equal(r.code, 0);
  assert.equal(d.calls.runs.length, 0); assert.equal(d.calls.mail.length, 0);
  assert.equal(d.calls.github[0].dry, true);
  assert.equal(d.calls.apify[0]?.dry ?? true, true);
});

test('--source github --no-report runs only github and sends nothing', async () => {
  const d = deps();
  await go(['--source', 'github', '--no-report'], ENV, d);
  assert.equal(d.calls.github.length, 1); assert.equal(d.calls.apify.length, 0); assert.equal(d.calls.mail.length, 0);
});

test('a failing source is logged ok:false and does not stop the other one; exit code stays 0 with the error in the report', async () => {
  const d = deps({ runGithub: async () => { throw new Error('search 422'); } });
  const r = await go([], ENV, d);
  assert.equal(r.code, 0);
  const gh = d.calls.runs.find((x) => x.source === 'github');
  assert.equal(gh.ok, false); assert.match(gh.notes, /search 422/);
  assert.equal(d.calls.apify.length, 1);
});

test('exhausted apify budget skips the source', async () => {
  const d = deps({ createDb: () => ({ ping: async () => {}, logRun: async () => {}, countsSince: async () => ({ ...COUNTS, spendToday: 2.0 }) }) });
  await go(['--source', 'apify', '--no-report'], ENV, d);
  assert.equal(d.calls.apify[0]?.budgetUsd ?? 0, 0);
});

test('report email failure is surfaced as exit 1 but runs were already logged', async () => {
  const d = deps({ sendReport: async () => { throw new Error('report not sent: 200 no auth'); } });
  const r = await go([], ENV, d);
  assert.equal(r.code, 1);
  assert.equal(d.calls.runs.length, 2);
});

test('apify budget is also capped by the lifetime total (APIFY_TOTAL_USD, default 2.00)', async () => {
  const d = deps({ createDb: () => ({ ping: async () => {}, logRun: async () => {}, countsSince: async () => ({ ...COUNTS, spendToday: 0, spendTotal: 1.7 }) }) });
  await go(['--source', 'apify', '--no-report'], ENV, d);
  assert.equal(d.calls.apify[0].budgetUsd, 0.3);
  const d2 = deps({ createDb: () => ({ ping: async () => {}, logRun: async () => {}, countsSince: async () => ({ ...COUNTS, spendToday: 0, spendTotal: 1.7 }) }) });
  await go(['--source', 'apify', '--no-report'], { ...ENV, APIFY_TOTAL_USD: '10' }, d2);
  assert.equal(d2.calls.apify[0].budgetUsd, 2);
});

test('when Supabase is down a short ABORTED report is still emailed', async () => {
  const d = deps({ createDb: () => ({ ping: async () => { throw new Error('Supabase unreachable'); } }) });
  const r = await go([], ENV, d);
  assert.equal(r.code, 1);
  assert.equal(d.calls.mail.length, 1);
  assert.match(d.calls.mail[0].m.subject, /ABORTED/);
  assert.match(d.calls.mail[0].m.text, /Supabase unreachable/);
});

test('dry run does not email the abort notice', async () => {
  const d = deps({ createDb: () => ({ ping: async () => { throw new Error('Supabase unreachable'); } }) });
  await go(['--dry'], ENV, d);
  assert.equal(d.calls.mail.length, 0);
});

test('logRun failing after apify billed: retried, then the spend is printed and added to the report, run does not crash', async () => {
  let tries = 0;
  const d = deps({ createDb: () => ({ ping: async () => {}, countsSince: async () => COUNTS, logRun: async (r) => { if (r.source === 'apify_linkedin') { tries++; throw new Error('db blip'); } } }) });
  const r = await go([], ENV, d);
  assert.equal(tries, 3);
  assert.match(r.out, /SPEND NOT RECORDED.*0\.4/);
  assert.match(d.calls.mail[0].m.text, /\$0\.40 was not recorded/i);
  assert.equal(r.code, 1);
});

test('logRun succeeding on the second try records normally', async () => {
  let n = 0; const rows = [];
  const d = deps({ createDb: () => ({ ping: async () => {}, countsSince: async () => COUNTS, logRun: async (x) => { if (x.source === 'apify_linkedin' && ++n === 1) throw new Error('blip'); rows.push(x); } }) });
  const r = await go([], ENV, d);
  assert.equal(r.code, 0);
  assert.equal(rows.filter((x) => x.source === 'apify_linkedin').length, 1);
});

// ---- scale: leads target, Firecrawl step ----
const FC_ENV = { ...ENV, FIRECRAWL_API_KEY: 'FC', FIRECRAWL_PAGES_PER_DAY: '40' };
const siteDeps = (over = {}) => {
  const d = deps({
    runGithub: async (o) => { d.calls.github.push(o); return { scanned: 3, found: 2, kept: 2, inserted: 2, notes: '', candidates: [{ repo: 'o/x', url: 'https://x.io' }] }; },
    runSites: async (o) => { d.calls.sites.push(o); return { pages: 12, dead: 3, skipped: 1, errors: 0, extra: 4, inserted: 4, examined: 30, stopped: null, notes: '' }; },
    creditUsage: async () => 1100,
    ...over,
  });
  d.calls.sites = []; return d;
};

test('github gets the leads target (default 1000) and the raised repo budget (default 7000)', async () => {
  const d = deps();
  const { GITHUB_REPOS_PER_DAY, ...env } = ENV;
  await go(['--source', 'github', '--no-report'], env, d);
  assert.equal(d.calls.github[0].leadsTarget, 1000 - COUNTS.newToday.github);
  assert.equal(d.calls.github[0].budget, 7000);
});

test('GITHUB_LEADS_PER_DAY is what is left of today: a rerun after the target was hit scans nothing more', async () => {
  const d = deps({ createDb: () => ({ ping: async () => {}, logRun: async () => {}, countsSince: async () => ({ ...COUNTS, newToday: { github: 1200, apify_linkedin: 0 } }) }) });
  await go(['--source', 'github', '--no-report'], { ...ENV, GITHUB_LEADS_PER_DAY: '1000' }, d);
  assert.equal(d.calls.github[0].leadsTarget, 0);
});

test('Firecrawl step runs after github with the cap, the candidates, and pages already used today; logged as source firecrawl', async () => {
  const d = siteDeps({ createDb: () => ({ ping: async () => {}, logRun: async (r) => { d.calls.runs.push(r); }, countsSince: async () => ({ ...COUNTS, pagesToday: 10 }) }) });
  const r = await go(['--no-report'], FC_ENV, d);
  assert.equal(r.code, 0);
  const s = d.calls.sites[0];
  assert.equal(s.cap, 40); assert.equal(s.usedToday, 10); assert.equal(s.apiKey, 'FC'); assert.equal(s.dry, false);
  assert.deepEqual(s.candidates, [{ repo: 'o/x', url: 'https://x.io' }]);
  assert.equal(d.calls.github[0].candidateLimit, 15);
  const run = d.calls.runs.find((x) => x.source === 'firecrawl');
  assert.equal(run.scanned, 12); assert.equal(run.kept, 4); assert.equal(run.spend_usd, 0); assert.equal(run.ok, true);
  assert.equal(run.data.dead, 3);
});

test('no FIRECRAWL_API_KEY or a zero cap: the site step is skipped and github gets no candidate budget', async () => {
  const d = siteDeps();
  await go(['--no-report'], ENV, d);
  assert.equal(d.calls.sites.length, 0); assert.equal(d.calls.github[0].candidateLimit, 0);
  const d2 = siteDeps();
  await go(['--no-report'], { ...FC_ENV, FIRECRAWL_PAGES_PER_DAY: '0' }, d2);
  assert.equal(d2.calls.sites.length, 0);
});

test('--source apify never runs the site step; a site step crash is logged ok:false and the run goes on', async () => {
  const d = siteDeps();
  await go(['--source', 'apify', '--no-report'], FC_ENV, d);
  assert.equal(d.calls.sites.length, 0);
  const d2 = siteDeps({ runSites: async () => { throw new Error('boom'); } });
  const r = await go(['--no-report'], FC_ENV, d2);
  assert.equal(r.code, 0);
  const run = d2.calls.runs.find((x) => x.source === 'firecrawl');
  assert.equal(run.ok, false); assert.match(run.notes, /boom/);
});

test('dry run does the domain checks (site step gets dry:true) and writes no firecrawl run', async () => {
  const d = siteDeps();
  await go(['--dry', '--no-report'], FC_ENV, d);
  assert.equal(d.calls.sites[0].dry, true); assert.equal(d.calls.runs.length, 0);
});

test('the report carries Firecrawl pages used and credits left', async () => {
  const d = siteDeps({ createDb: () => ({ ping: async () => {}, logRun: async () => {}, countsSince: async () => ({ ...COUNTS, pagesToday: 12 }) }) });
  await go([], FC_ENV, d);
  assert.match(d.calls.mail[0].m.text, /Firecrawl: 12 of 40 pages used today, 1100 credits left/);
});

test('apify gets the wait window from APIFY_MAX_WAIT_MIN', async () => {
  const d = deps();
  await go(['--source', 'apify', '--no-report'], { ...ENV, APIFY_MAX_WAIT_MIN: '45' }, d);
  assert.equal(d.calls.apify[0].maxWaitMs, 45 * 60 * 1000);
});

test('a dry run is a smoke test: it scans at most DRY_REPOS_PER_RUN (default 300) repos, not hours of rate limit', async () => {
  const d = deps();
  await go(['--dry', '--source', 'github', '--no-report'], { ...ENV, GITHUB_REPOS_PER_DAY: '7000' }, d);
  assert.equal(d.calls.github[0].budget, 300);
  const d2 = deps();
  await go(['--dry', '--source', 'github', '--no-report'], { ...ENV, GITHUB_REPOS_PER_DAY: '7000', DRY_REPOS_PER_RUN: '50' }, d2);
  assert.equal(d2.calls.github[0].budget, 50);
});
