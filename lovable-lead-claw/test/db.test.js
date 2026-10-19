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
