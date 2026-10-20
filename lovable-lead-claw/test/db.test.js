import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';

function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const r = await handler(call);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers || {} });
  };
  f.calls = calls;
  return f;
}
const mk = (handler) => { const fetch = fakeFetch(handler); return { fetch, db: createDb({ url: 'https://x.supabase.co', key: 'k', fetch }) }; };

test('ping aborts when the DB is unreachable', async () => {
  const { db } = mk(() => ({ status: 503, body: { message: 'down' } }));
  await assert.rejects(() => db.ping(), /unreachable/i);
  const { db: db2 } = mk(() => { throw new Error('ECONNREFUSED'); });
  await assert.rejects(() => db2.ping(), /unreachable/i);
});

test('insertLeads uses ignore-duplicates and returns only rows actually inserted', async () => {
  const { db, fetch } = mk(() => ({ status: 201, body: [{ id: 1, email: 'a@x.io' }] }));
  const inserted = await db.insertLeads([{ email: 'a@x.io', source: 'github' }, { email: 'dup@x.io', source: 'github' }]);
  assert.deepEqual(inserted.map((r) => r.email), ['a@x.io']);
  const c = fetch.calls[0];
  assert.match(c.url, /\/rest\/v1\/lovable_leads\?on_conflict=email$/);
  assert.equal(c.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
  assert.equal(c.headers.apikey, 'k');
  assert.equal(c.body.length, 2);
});

test('insertLeads dedups emails case-insensitively inside one batch and skips empty batch', async () => {
  const { db, fetch } = mk(() => ({ status: 201, body: [] }));
  await db.insertLeads([{ email: 'A@x.io' }, { email: 'a@x.io' }]);
  assert.equal(fetch.calls[0].body.length, 1);
  assert.deepEqual(await db.insertLeads([]), []);
  assert.equal(fetch.calls.length, 1);
});

test('insertLeads throws on HTTP error instead of pretending success', async () => {
  const { db } = mk(() => ({ status: 400, body: { message: 'bad' } }));
  await assert.rejects(() => db.insertLeads([{ email: 'a@x.io' }]), /400/);
});

test('cursor round trip', async () => {
  const { db, fetch } = mk((c) => (c.method === 'GET' ? { body: [{ cursor: { shard: 2, page: 4 } }] } : { status: 201 }));
  assert.deepEqual(await db.getCursor('github'), { shard: 2, page: 4 });
  await db.setCursor('github', { shard: 3, page: 1 });
  const post = fetch.calls.find((c) => c.method === 'POST');
  assert.match(post.url, /lovable_lead_cursors\?on_conflict=source/);
  assert.equal(post.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.deepEqual(post.body.cursor, { shard: 3, page: 1 });
});

test('getCursor returns null when none stored', async () => {
  const { db } = mk(() => ({ body: [] }));
  assert.equal(await db.getCursor('apify'), null);
});

test('existingRepos returns the subset already stored', async () => {
  const { db, fetch } = mk(() => ({ body: [{ repo: 'o/a' }] }));
  const set = await db.existingRepos(['o/a', 'o/b']);
  assert.deepEqual([...set], ['o/a']);
  assert.match(decodeURIComponent(fetch.calls[0].url), /repo=in\.\("o\/a","o\/b"\)/);
});

test('logRun posts a run row', async () => {
  const { db, fetch } = mk(() => ({ status: 201 }));
  await db.logRun({ source: 'github', scanned: 5, found: 3, kept: 2, spend_usd: 0, ok: true, notes: 'n' });
  assert.match(fetch.calls[0].url, /lovable_lead_runs$/);
  assert.equal(fetch.calls[0].body.kept, 2);
});

test('countsSince builds the report numbers', async () => {
  const { db } = mk((c) => {
    const u = decodeURIComponent(c.url);
    if (u.includes('lovable_lead_runs')) return { body: [
      { source: 'apify_linkedin', spend_usd: 0.5, run_at: '2026-10-19T07:00:00Z', scanned: 0, ok: true, notes: '' },
      { source: 'apify_linkedin', spend_usd: 1.0, run_at: '2026-10-05T07:00:00Z', scanned: 0, ok: true, notes: '' },
      { source: 'github', spend_usd: 0, run_at: '2026-10-19T07:00:00Z', scanned: 40, ok: false, notes: 'boom' }] };
    const m = { 'source=eq.github': 7, 'source=eq.apify_linkedin': 2, 'enrolled_by=is.null': 8 };
    const key = Object.keys(m).find((k) => u.includes(k));
    return { body: [], headers: { 'content-range': `0-0/${key ? m[key] : 9}` } };
  });
  const r = await db.countsSince('2026-10-19', '2026-10-01');
  assert.equal(r.total, 9);
  assert.equal(r.unsent, 8);
  assert.equal(r.spendToday, 0.5);
  assert.equal(r.spendMonth, 1.5);
  assert.equal(r.githubScanned, 40);
  assert.deepEqual(r.errors, ['github: boom']);
});

test('emailRepos merges the row repo with data.repos; addRepo appends without losing data; rejectEmail never touches enrolled rows', async () => {
  const { db, fetch } = mk((c) => {
    if (c.method === 'GET' && /select=email,repo,data/.test(c.url)) return { body: [{ email: 'A@x.io', repo: 'o/a', data: { repos: ['o/b'] } }] };
    if (c.method === 'GET') return { body: [{ data: { homepage: 'h', repos: ['o/b'] } }] };
    return { status: 204 };
  });
  const m = await db.emailRepos(['a@x.io']);
  assert.deepEqual([...m.get('a@x.io')].sort(), ['o/a', 'o/b']);
  await db.addRepo('a@x.io', 'o/c');
  const patch = fetch.calls.find((c) => c.method === 'PATCH');
  assert.deepEqual(patch.body.data, { homepage: 'h', repos: ['o/b', 'o/c'] });
  await db.rejectEmail('a@x.io');
  const rej = fetch.calls.filter((c) => c.method === 'PATCH').at(-1);
  assert.match(rej.url, /enrolled_by=is\.null/); assert.equal(rej.body.status, 'rejected');
});

// ---- site (Firecrawl) support ----
test('leadsNeedingSite asks for unscraped, non-rejected rows oldest first, new-today rows or backfill rows', async () => {
  const { db, fetch } = mk(() => ({ body: [{ id: 5, email: 'a@x.io', data: {} }] }));
  const rows = await db.leadsNeedingSite({ firstSeen: '2026-10-20', afterId: 3, limit: 50 });
  assert.equal(rows.length, 1);
  const u = decodeURIComponent(fetch.calls[0].url);
  assert.match(u, /data->site=is\.null/); assert.match(u, /status=neq\.rejected/); assert.match(u, /first_seen=eq\.2026-10-20/);
  assert.match(u, /id=gt\.3/); assert.match(u, /order=id\.asc/); assert.match(u, /limit=50/);
  await db.leadsNeedingSite({ before: '2026-10-20', afterId: 0, limit: 10 });
  assert.match(decodeURIComponent(fetch.calls[1].url), /first_seen=lt\.2026-10-20/);
});

test('setSite merges the site block into the row data without losing the rest', async () => {
  const { db, fetch } = mk(() => ({ status: 204 }));
  await db.setSite({ id: 7, data: { homepage: 'h', repos: ['o/a'] } }, { status: 'ok', emails: [] });
  const c = fetch.calls[0];
  assert.equal(c.method, 'PATCH'); assert.match(c.url, /id=eq\.7/);
  assert.deepEqual(c.body.data, { homepage: 'h', repos: ['o/a'], site: { status: 'ok', emails: [] } });
});

test('siteForDomain returns an already scraped site block for the domain, or null', async () => {
  const { db, fetch } = mk(() => ({ body: [{ data: { site: { status: 'ok', emails: ['a@x.io'] } } }] }));
  assert.deepEqual(await db.siteForDomain('x.io'), { status: 'ok', emails: ['a@x.io'] });
  assert.match(decodeURIComponent(fetch.calls[0].url), /domain=eq\.x\.io/);
  const { db: db2 } = mk(() => ({ body: [] }));
  assert.equal(await db2.siteForDomain('y.io'), null);
});

test('firecrawlPagesSince sums the pages logged by firecrawl runs since the given time', async () => {
  const { db, fetch } = mk(() => ({ body: [{ scanned: 12 }, { scanned: 3 }] }));
  assert.equal(await db.firecrawlPagesSince('2026-10-20T00:00:00Z'), 15);
  const u = decodeURIComponent(fetch.calls[0].url);
  assert.match(u, /source=eq\.firecrawl/); assert.match(u, /run_at=gte\.2026-10-20/);
});

test('countsSince also reports firecrawl pages today and how many leads are scraped / still waiting', async () => {
  const { db } = mk((c) => {
    const u = decodeURIComponent(c.url);
    if (u.includes('lovable_lead_runs')) return { body: [{ source: 'firecrawl', spend_usd: 0, run_at: '2026-10-20T07:00:00Z', scanned: 40, ok: true, notes: '' }] };
    const m = { 'data->site=not.is.null': 11, 'data->site=is.null': 700, 'data->>via=eq.site': 4 };
    const key = Object.keys(m).find((k) => u.includes(k));
    return { body: [], headers: { 'content-range': `0-0/${key ? m[key] : 9}` } };
  });
  const r = await db.countsSince('2026-10-20T00:00:00Z', '2026-10-01');
  assert.equal(r.pagesToday, 40); assert.equal(r.scraped, 11); assert.equal(r.unscraped, 700); assert.equal(r.viaSiteToday, 4);
});
