import test from 'node:test';
import assert from 'node:assert/strict';
import { runGithub, nextCursor } from '../src/github.js';

// Fake GitHub + web. repos: { 'o/name': { homepage, description, fork, commits:[{email,name,login}], live: true|false } }
function world(repos, { totals = {}, searchFail, repoStatus = {} } = {}) {
  const log = { searches: [], repoCalls: [], inserts: [], cursors: [], fetchUrls: [] };
  const names = Object.keys(repos);
  const f = async (url, init = {}) => {
    url = String(url); log.fetchUrls.push(url);
    const u = new URL(url);
    const json = (b, status = 200, headers = {}) => new Response(JSON.stringify(b), { status, headers });
    if (u.hostname === 'api.github.com' && u.pathname === '/search/code') {
      const q = u.searchParams.get('q'); const page = Number(u.searchParams.get('page'));
      log.searches.push({ q, page, per_page: u.searchParams.get('per_page') });
      if (searchFail && searchFail.shift()) return json({ message: 'rate' }, 403, { 'retry-after': '1' });
      const inFirstShard = /size:0\.\./.test(q);   // all fake repos live in the first size shard
      const total = totals[q] ?? (inFirstShard ? names.length : 0);
      const items = page === 1 && inFirstShard ? names.map((n) => ({ repository: { full_name: n } })) : [];
      return json({ total_count: total, items });
    }
    let m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/commits$/);
    if (u.hostname === 'api.github.com' && m) {
      log.repoCalls.push(`commits:${m[1]}`);
      return json(repos[m[1]].commits.map((c) => ({ commit: { author: { email: c.email, name: c.name } }, author: { login: c.login } })));
    }
    m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)$/);
    if (u.hostname === 'api.github.com' && m) {
      log.repoCalls.push(`repo:${m[1]}`);
      if (repoStatus[m[1]]) return json({ message: 'x' }, repoStatus[m[1]].status, repoStatus[m[1]].headers || {});
      const r = repos[m[1]];
      return json({ full_name: m[1], name: m[1].split('/')[1], description: r.description ?? '', homepage: r.homepage ?? '', fork: !!r.fork, archived: false, pushed_at: '2026-10-01T00:00:00Z', owner: { type: 'User', login: m[1].split('/')[0] } });
    }
    // homepage liveness
    const site = Object.values(repos).find((r) => r.homepage && url.startsWith(r.homepage.replace(/\/$/, '')));
    if (site) return new Response(null, { status: site.live ? 200 : 404 });
    return new Response(null, { status: 404 });
  };
  const db = {
    stored: new Set(), cursor: null,
    existingRepos: async (rs) => new Set(rs.filter((r) => db.stored.has(r))),
    getCursor: async () => db.cursor,
    setCursor: async (_s, c) => { db.cursor = c; log.cursors.push(c); },
    emailRepos: async () => db.known || new Map(), addRepo: async (e, r) => { log.added = [...(log.added || []), [e, r]]; }, rejectEmail: async (e) => { log.rejected = [...(log.rejected || []), e]; },
    insertLeads: async (rows) => { log.inserts.push(...rows); return rows.map((r, i) => ({ id: i, ...r })); },
  };
  return { f, db, log };
}
const base = (w, over = {}) => ({ db: w.db, token: 't', fetch: w.f, sleep: async () => {}, budget: 100, today: '2026-10-19', ...over });
const E = (email, login = 'o') => ({ email, name: 'N', login });

test('keeps a live-homepage repo and a company-domain repo; drops dead+free, junk repo, junk email, forks', async () => {
  const w = world({
    'a/live': { homepage: 'https://live.example-app.io', live: true, commits: [E('x@gmail.com')] },
    'b/corp': { homepage: '', commits: [E('ceo@buildfast.io')] },
    'c/dead': { homepage: 'https://dead.app.io', live: false, commits: [E('y@gmail.com')] },
    'd/my-portfolio': { homepage: 'https://p.io', live: true, commits: [E('z@gmail.com')] },
    'e/noreply': { homepage: 'https://e.io', live: true, commits: [E('1+e@users.noreply.github.com')] },
    'f/fork': { homepage: 'https://f.io', live: true, fork: true, commits: [E('f@gmail.com')] },
    'g/pages': { homepage: 'https://g.github.io/x', live: true, commits: [E('g@gmail.com')] },
  });
  const r = await runGithub(base(w));
  assert.deepEqual(w.log.inserts.map((l) => l.email).sort(), ['ceo@buildfast.io', 'x@gmail.com']);
  const live = w.log.inserts.find((l) => l.email === 'x@gmail.com');
  assert.equal(live.source, 'github'); assert.equal(live.repo, 'a/live'); assert.equal(live.domain, 'live.example-app.io');
  assert.equal(live.url, 'https://live.example-app.io'); assert.equal(live.first_seen, '2026-10-19'); assert.equal(live.status, undefined);
  const corp = w.log.inserts.find((l) => l.email === 'ceo@buildfast.io');
  assert.equal(corp.domain, 'buildfast.io'); assert.equal(corp.url, 'https://buildfast.io');
  assert.equal(r.scanned, 7); assert.equal(r.kept, 2);
});

test('repos already in the DB are not re-fetched', async () => {
  const w = world({ 'a/one': { commits: [E('a@buildfast.io')] }, 'b/two': { commits: [E('b@buildfast.io')] } });
  w.db.stored.add('a/one');
  await runGithub(base(w));
  assert.ok(!w.log.repoCalls.some((c) => c.endsWith('a/one')));
  assert.deepEqual(w.log.inserts.map((l) => l.repo), ['b/two']);
});

test('an email on 3 unrelated repos is dropped as a template artifact', async () => {
  const w = world({
    'a/x': { commits: [E('lib@buildfast.io')] }, 'b/y': { commits: [E('lib@buildfast.io')] }, 'c/z': { commits: [E('lib@buildfast.io'), E('real@otherco.io')] },
  });
  await runGithub(base(w));
  assert.deepEqual(w.log.inserts.map((l) => l.email), ['real@otherco.io']);
});

test('daily budget stops mid-page and the cursor resumes at the same page with skip', async () => {
  const repos = {}; for (let i = 0; i < 5; i++) repos[`o/r${i}`] = { commits: [E(`u${i}@co${i}.io`)] };
  const w = world(repos);
  const r = await runGithub(base(w, { budget: 2 }));
  assert.equal(r.scanned, 2);
  assert.equal(w.log.inserts.length, 2);
  assert.equal(w.db.cursor.page, 1); assert.equal(w.db.cursor.skip, 2);
  // next day resumes
  w.log.inserts.length = 0; w.log.searches.length = 0;
  const r2 = await runGithub(base(w, { budget: 100 }));
  assert.equal(w.log.searches[0].page, 1);
  assert.deepEqual(w.log.inserts.map((l) => l.repo), ['o/r2', 'o/r3', 'o/r4']);
  assert.equal(r2.scanned, 3);
});

test('finishing a shard moves the cursor to the next size range', async () => {
  const w = world({ 'o/a': { commits: [E('a@co.io')] } });
  await runGithub(base(w));
  assert.ok(w.db.cursor.lo > 0); assert.equal(w.db.cursor.page, 1); assert.equal(w.db.cursor.skip, 0);
  assert.match(w.log.searches[0].q, /"lovable-tagger" filename:package\.json size:0\.\.\d+/);
});

test('a shard over 1000 results is split before paging', async () => {
  const w = world({ 'o/a': { commits: [E('a@co.io')] } }, { totals: { '"lovable-tagger" filename:package.json size:0..199': 5000 } });
  w.db.cursor = { lo: 0, hi: 199, page: 1, skip: 0, step: 200 };
  await runGithub(base(w, { budget: 1 }));
  const qs = w.log.searches.map((s) => s.q);
  assert.equal(qs[0], '"lovable-tagger" filename:package.json size:0..199');
  assert.match(qs[1], /size:0\.\.99$/);
});

test('403 on search sleeps for the reset window and retries', async () => {
  const w = world({ 'o/a': { commits: [E('a@co.io')] } }, { searchFail: [true] });
  const slept = [];
  await runGithub(base(w, { sleep: async (ms) => { slept.push(ms); } }));
  assert.ok(slept.some((ms) => ms >= 1000));
  assert.equal(w.log.inserts.length, 1);
});

test('dry run writes nothing to the DB', async () => {
  const w = world({ 'o/a': { commits: [E('a@co.io')] } });
  const r = await runGithub(base(w, { dry: true }));
  assert.equal(w.log.inserts.length, 0); assert.equal(w.log.cursors.length, 0);
  assert.equal(r.kept, 1); assert.equal(r.inserted, 0);
});

test('nextCursor widens the step when a shard was sparse', () => {
  const c = nextCursor({ lo: 0, hi: 199, step: 200 }, 100);
  assert.equal(c.lo, 200); assert.ok(c.hi >= 399); assert.equal(c.page, 1);
});

test('a non-rate-limit 403 (blocked repo) is skipped without sleeping', async () => {
  const w = world({ 'a/blocked': { commits: [E('a@co.io')] }, 'b/ok': { commits: [E('b@co2.io')] } },
    { repoStatus: { 'a/blocked': { status: 403, headers: { 'x-ratelimit-remaining': '4000', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3000) } } } });
  const slept = [];
  await runGithub(base(w, { sleep: async (ms) => { slept.push(ms); } }));
  assert.equal(slept.filter((ms) => ms > 60000).length, 0);
  assert.deepEqual(w.log.inserts.map((l) => l.repo), ['b/ok']);
});

test('a 403 with remaining=0 sleeps until the reset', async () => {
  const w = world({ 'a/x': { commits: [E('a@co.io')] } },
    { repoStatus: { 'a/x': { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 30) } } } });
  const slept = [];
  await runGithub(base(w, { sleep: async (ms) => { slept.push(ms); } }));
  assert.ok(slept.some((ms) => ms >= 20000));
});

test('repos whose fetch errors are counted as failed in the notes', async () => {
  const w = world({ 'a/x': { commits: [E('a@co.io')] }, 'b/y': { commits: [E('b@co.io')] } }, { repoStatus: { 'a/x': { status: 502 } } });
  const r = await runGithub(base(w));
  assert.match(r.notes, /1 repos? failed/);
});

test('an email already stored on 2 other repos is dropped when it shows up on a third', async () => {
  const w = world({ 'c/z': { commits: [E('lib@buildfast.io'), E('real@otherco.io')] } });
  w.db.known = new Map([['lib@buildfast.io', new Set(['a/x', 'b/y'])]]);
  await runGithub(base(w));
  assert.deepEqual(w.log.inserts.map((l) => l.email), ['real@otherco.io']);
  assert.deepEqual(w.log.rejected, ['lib@buildfast.io']);
});
