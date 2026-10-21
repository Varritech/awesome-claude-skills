import test from 'node:test';
import assert from 'node:assert/strict';
import { runSites, siteTarget, ownDomainEmails } from '../src/site.js';

const TODAY = '2026-10-20';
// pages: url -> { title, description, markdown, links } | 'credits' | 'rate'; live: hostname -> bool (default true); dnsDead: Set of hostnames
function world({ rows = [], pages = {}, live = {}, dnsDead = [], siteFor = {} } = {}) {
  const log = { scraped: [], liveChecks: [] };
  const f = async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.firecrawl.dev') {
      const target = JSON.parse(init.body).url; log.scraped.push(target);
      const p = pages[target];
      if (p === 'credits') return new Response('{}', { status: 402 });
      if (p === 'rate') return new Response('{}', { status: 429 });
      if (!p) return new Response(JSON.stringify({ success: true, data: { markdown: '', links: [], metadata: {} } }), { status: 200 });
      return new Response(JSON.stringify({ success: true, data: { markdown: p.markdown || '', links: p.links || [], metadata: { title: p.title, description: p.description } } }), { status: 200 });
    }
    log.liveChecks.push(u.hostname);
    if (live[u.hostname] === 'timeout') throw new Error('timeout');
    log.hit = (log.hit || []).concat(u.hostname);
    return new Response(null, { status: typeof live[u.hostname] === 'number' ? live[u.hostname] : live[u.hostname] === false ? 404 : 200 });
  };
  const s = { rows: rows.map((r, i) => ({ id: i + 1, source: 'github', first_seen: '2026-10-01', data: {}, ...r })), inserted: [], sites: new Map() };
  const db = {
    s,
    leadsNeedingSite: async ({ firstSeen, before, afterId = 0, limit = 200 }) => s.rows.filter((r) => !r.data.site && !s.sites.has(r.id) && r.id > afterId && (firstSeen ? r.first_seen === firstSeen : before ? r.first_seen < before : true)).slice(0, limit),
    setSite: async (row, site) => { s.sites.set(row.id, site); },
    siteForDomain: async (d) => siteFor[d] || null,
    insertLeads: async (rows) => { s.inserted.push(...rows); return rows; },
  };
  const look = async (h) => { if (dnsDead.includes(h)) throw new Error('ENOTFOUND'); return { address: '1.1.1.1' }; };
  return { db, f, look, log };
}
const go = (w, over = {}) => runSites({ db: w.db, apiKey: 'FCKEY', cap: 40, usedToday: 0, today: TODAY, fetch: w.f, look: w.look, concurrency: 1, ...over });
const row = (email, extra = {}) => ({ email, domain: extra.domain, url: extra.url, data: { homepage: extra.url, homepage_live: true }, ...extra });

test('a dead domain is marked dead and costs no Firecrawl credit (DNS failure or HTTP failure)', async () => {
  const w = world({ rows: [row('a@gone.io', { url: 'https://gone.io', domain: 'gone.io' }), row('b@down.io', { url: 'https://down.io', domain: 'down.io' })], dnsDead: ['gone.io'], live: { 'down.io': false } });
  const r = await go(w);
  assert.equal(w.log.scraped.length, 0); assert.equal(r.pages, 0); assert.equal(r.dead, 2);
  assert.equal(w.db.s.sites.get(1).status, 'dead'); assert.equal(w.db.s.sites.get(2).status, 'dead');
});

test('a live site is scraped through Firecrawl and stored as data.site {title, description, emails, scraped_at, status}', async () => {
  const w = world({ rows: [row('a@acme.io', { url: 'https://acme.io', domain: 'acme.io' })], pages: { 'https://acme.io': { title: 'Acme', description: 'We build', markdown: 'hi' } } });
  const r = await go(w);
  assert.equal(r.pages, 1);
  assert.deepEqual(w.db.s.sites.get(1), { title: 'Acme', description: 'We build', emails: [], scraped_at: TODAY, status: 'ok' });
});

test('own-domain emails on the site become extra rows (source github, same repo, via=site); webmail, other domains, junk and role mailboxes do not', async () => {
  const md = 'contact@acme.io hello@acme.io jane.doe@gmail.com sales@other.com privacy@acme.io noreply@acme.io a@acme.io b@acme.io me@acme.io info@sub.acme.io';
  const w = world({ rows: [row('me@acme.io', { url: 'https://acme.io', domain: 'acme.io', repo: 'o/acme', name: 'Me' })], pages: { 'https://acme.io': { title: 'Acme', markdown: md } } });
  const r = await go(w);
  const extra = w.db.s.inserted;
  assert.ok(extra.length > 0 && extra.length <= 3, `got ${extra.length}`);
  for (const e of extra) {
    assert.equal(e.source, 'github'); assert.equal(e.repo, 'o/acme'); assert.equal(e.data.via, 'site'); assert.equal(e.domain, 'acme.io');
    assert.equal(e.url, 'https://acme.io'); assert.equal(e.first_seen, TODAY); assert.equal(e.data.site.status, 'inherited');
    assert.ok(/@(.+\.)?acme\.io$/.test(e.email));
    assert.ok(!/^(privacy|noreply|me)@/.test(e.email), e.email);
  }
  assert.ok(extra.some((e) => e.email === 'contact@acme.io'));
  assert.equal(r.extra, extra.length);
});

test('the daily page cap holds across reruns: pages already used today count, and capped rows are left for tomorrow', async () => {
  const rows = ['a', 'b', 'c'].map((n) => row(`${n}@${n}.io`, { url: `https://${n}.io`, domain: `${n}.io` }));
  const w = world({ rows });
  const r = await go(w, { cap: 3, usedToday: 1 });
  assert.equal(r.pages, 2); assert.equal(w.log.scraped.length, 2);
  assert.equal(w.db.s.sites.size, 2);       // third row untouched, not marked
  assert.equal(r.stopped, 'cap');
});

test('402 (credits out) stops scraping for the day, not the run, and the row is not marked', async () => {
  const rows = ['a', 'b'].map((n) => row(`${n}@${n}.io`, { url: `https://${n}.io`, domain: `${n}.io` }));
  const w = world({ rows, pages: { 'https://a.io': 'credits' } });
  const r = await go(w);
  assert.equal(r.stopped, 'credits'); assert.equal(r.pages, 0); assert.equal(w.log.scraped.length, 1); assert.equal(w.db.s.sites.size, 0);
});

test('one scrape per domain: sibling rows share it, and a domain scraped on an earlier day is not paid for again', async () => {
  const rows = [row('a@acme.io', { url: 'https://acme.io', domain: 'acme.io' }), row('b@acme.io', { url: 'https://acme.io', domain: 'acme.io' }), row('c@old.io', { url: 'https://old.io', domain: 'old.io' })];
  const w = world({ rows, siteFor: { 'old.io': { status: 'ok', title: 'Old', emails: [], scraped_at: '2026-10-10' } } });
  const r = await go(w);
  assert.deepEqual(w.log.scraped, ['https://acme.io']); assert.equal(r.pages, 1);
  assert.equal(w.db.s.sites.size, 3); assert.equal(w.db.s.sites.get(3).title, 'Old');
});

test('rows with no live homepage and a webmail address have no site to check: marked skipped, no credit', async () => {
  const w = world({ rows: [{ email: 'x@gmail.com', domain: null, url: null, data: { homepage_live: false } }] });
  const r = await go(w);
  assert.equal(r.skipped, 1); assert.equal(w.db.s.sites.get(1).status, 'skipped'); assert.equal(w.log.scraped.length, 0);
});

test('a webmail builder with a live homepage is scraped via the homepage; a company-email lead without a homepage via the email domain', async () => {
  const w = world({ rows: [row('x@gmail.com', { url: 'https://app.io', domain: 'app.io' }), { email: 'ceo@buildfast.io', domain: 'buildfast.io', url: 'https://buildfast.io', data: { homepage_live: false } }] });
  await go(w);
  assert.deepEqual(w.log.scraped.sort(), ['https://app.io', 'https://buildfast.io']);
});

test("today's new leads are scraped before the old backlog, which then goes oldest first", async () => {
  const w = world({ rows: [
    row('old1@o1.io', { url: 'https://o1.io', domain: 'o1.io', first_seen: '2026-10-01' }),
    row('old2@o2.io', { url: 'https://o2.io', domain: 'o2.io', first_seen: '2026-10-02' }),
    row('new@n.io', { url: 'https://n.io', domain: 'n.io', first_seen: TODAY }),
  ] });
  await go(w);
  assert.deepEqual(w.log.scraped, ['https://n.io', 'https://o1.io', 'https://o2.io']);
});

test('repos whose commit emails were all junk but whose homepage is live: scrape the homepage, keep it if the site shows an own-domain email', async () => {
  const w = world({ pages: { 'https://nice.io': { title: 'Nice', markdown: 'founder@nice.io' }, 'https://empty.io': { title: 'E', markdown: 'nothing' } } });
  const cands = [{ repo: 'o/nice', url: 'https://nice.io', description: 'd' }, { repo: 'o/empty', url: 'https://empty.io', description: 'd' }];
  const r = await go(w, { candidates: cands });
  assert.deepEqual(w.db.s.inserted.map((e) => [e.email, e.repo, e.source, e.data.via]), [['founder@nice.io', 'o/nice', 'github', 'site']]);
  assert.equal(r.pages, 2);
});

test('dry run: checks domains but writes nothing, scrapes nothing, reports what it would scrape', async () => {
  const w = world({ rows: [row('a@acme.io', { url: 'https://acme.io', domain: 'acme.io' }), row('b@gone.io', { url: 'https://gone.io', domain: 'gone.io' })], dnsDead: ['gone.io'] });
  const r = await go(w, { dry: true });
  assert.equal(w.log.scraped.length, 0); assert.equal(w.db.s.sites.size, 0); assert.equal(w.db.s.inserted.length, 0);
  assert.equal(r.wouldScrape, 1); assert.equal(r.dead, 1);
});

test('an LinkedIn lead uses its company website, and siteTarget never points Firecrawl at a social profile or a lovable preview', () => {
  assert.equal(siteTarget({ source: 'apify_linkedin', email: 'a@gmail.com', domain: 'startup.io', url: 'https://startup.io/', data: {} }), 'https://startup.io');
  assert.equal(siteTarget({ source: 'apify_linkedin', email: 'a@gmail.com', domain: null, url: 'https://linkedin.com/in/a', data: {} }), null);
  assert.equal(siteTarget({ source: 'github', email: 'a@gmail.com', domain: 'x.lovable.app', url: 'https://x.lovable.app', data: { homepage: 'https://x.lovable.app', homepage_live: true } }), null);
  assert.deepEqual(ownDomainEmails(['hello@acme.io', 'x@acme.com'], 'www.acme.io'), ['hello@acme.io']);
});

test('an error on one site does not stop the run and the row is marked error', async () => {
  const f0 = world({ rows: [row('a@acme.io', { url: 'https://acme.io', domain: 'acme.io' }), row('b@b.io', { url: 'https://b.io', domain: 'b.io' })] });
  const f = async (u, i) => (String(u).includes('firecrawl') && JSON.parse(i.body).url === 'https://acme.io' ? new Response('{}', { status: 500 }) : f0.f(u, i));
  const r = await runSites({ db: f0.db, apiKey: 'k', cap: 40, usedToday: 0, today: TODAY, fetch: f, look: f0.look, concurrency: 1 });
  assert.equal(f0.db.s.sites.get(1).status, 'error'); assert.equal(f0.db.s.sites.get(2).status, 'ok'); assert.equal(r.errors, 1);
});

test('a timeout or 5xx is not proof of a dead site: nothing is persisted, no credit spent, and it is retried next run', async () => {
  const w = world({ rows: [row('a@slow.io', { url: 'https://slow.io', domain: 'slow.io' }), row('b@err.io', { url: 'https://err.io', domain: 'err.io' })], live: { 'slow.io': 'timeout', 'err.io': 503 } });
  const r = await go(w);
  assert.equal(r.pages, 0); assert.equal(r.dead, 0); assert.equal(r.flaky, 2);
  assert.equal(w.db.s.sites.size, 0); assert.equal(w.log.scraped.length, 0);
});

test('private and local hosts are never fetched: IP literals, localhost, and names that resolve to private ranges', async () => {
  const w = world({
    rows: [row('a@gmail.com', { url: 'http://192.168.1.5', domain: 'x.io' }), row('b@gmail.com', { url: 'http://localhost:3000', domain: 'y.io' }), row('c@gmail.com', { url: 'http://169.254.169.254', domain: 'z.io' }), row('d@gmail.com', { url: 'https://sneaky.io', domain: 'sneaky.io' })],
  });
  const r = await go(w, { look: async (h) => ({ address: h === 'sneaky.io' ? '10.0.0.7' : '1.1.1.1' }) });
  assert.equal(r.pages, 0); assert.equal(w.log.scraped.length, 0); assert.deepEqual(w.log.hit || [], []);
  assert.equal(w.db.s.sites.get(4).status, 'dead');
});

test('pages scraped are checkpointed after each batch so a killed run still counts against the daily cap', async () => {
  const rows = [1, 2, 3].map((i) => row(`a@s${i}.io`, { url: `https://s${i}.io`, domain: `s${i}.io` }));
  const w = world({ rows, pages: Object.fromEntries([1, 2, 3].map((i) => [`https://s${i}.io`, { title: `S${i}`, markdown: '' }])) });
  const seen = [];
  const r = await go(w, { batch: 2, checkpoint: async (n) => { seen.push(n); } });
  assert.equal(r.pages, 3);
  assert.deepEqual(seen, [2, 1]);
});
