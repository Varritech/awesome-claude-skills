import test from 'node:test';
import assert from 'node:assert/strict';
import { runApify, maxItemsFor, estimateCost } from '../src/apify.js';

test('maxItemsFor never lets the worst-case cost exceed the budget', () => {
  for (const b of [0.1, 0.35, 0.5, 1, 1.99, 2, 2.8, 5]) {
    const n = maxItemsFor(b);
    assert.ok(estimateCost(n) <= b + 1e-9, `budget ${b} -> ${n} items costs ${estimateCost(n)}`);
    assert.ok(estimateCost(n + 1) > b, `budget ${b} -> ${n} is not the largest`);
  }
  assert.equal(maxItemsFor(0), 0);
  assert.equal(maxItemsFor(0.05), 0);
});

function apify({ items, status = 'SUCCEEDED', usage = 0.62, polls = 2, dsStatus = 200 }) {
  const calls = [];
  let polled = 0;
  const f = async (url, init = {}) => {
    url = String(url); const u = new URL(url);
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined });
    const json = (b) => new Response(JSON.stringify(b), { status: 200 });
    if (init.method === 'POST' && u.pathname.endsWith('/runs')) return json({ data: { id: 'run1', status: 'RUNNING', defaultDatasetId: 'ds1' } });
    if (u.pathname === '/v2/actor-runs/run1') { polled++; return json({ data: { id: 'run1', status: polled >= polls ? status : 'RUNNING', usageTotalUsd: usage, defaultDatasetId: 'ds1' } }); }
    if (u.pathname === '/v2/datasets/ds1/items') return dsStatus === 200 ? json(items) : new Response('boom', { status: dsStatus });
    throw new Error('unexpected ' + url);
  };
  return { f, calls };
}
const mkdb = (cursor = null) => {
  const s = { cursor, inserted: [] };
  return { s, getCursor: async () => s.cursor, setCursor: async (_n, c) => { s.cursor = c; }, insertLeads: async (r) => { s.inserted.push(...r); return r; } };
};
const run = (db, a, over = {}) => runApify({ db, token: 'SECRET_TOKEN', fetch: a.f, sleep: async () => {}, budgetUsd: 2, today: '2026-10-19', ...over });

const ITEMS = [
  { firstName: 'Ann', lastName: 'Lee', linkedinUrl: 'https://linkedin.com/in/ann', emails: [{ email: 'ann@buildfast.io' }], headline: 'Founder', currentPosition: [{ companyName: 'BuildFast', position: 'Founder', companyWebsite: 'https://buildfast.io/' }] },
  { firstName: 'Bob', lastName: 'No', linkedinUrl: 'https://linkedin.com/in/bob', currentPosition: [{ companyName: 'X' }] },
  { firstName: 'Cy', lastName: 'Junk', linkedinUrl: 'https://linkedin.com/in/cy', email: 'noreply@cy.com' },
  { firstName: 'Di', lastName: 'Gmail', linkedinUrl: 'https://linkedin.com/in/di', email: 'di@gmail.com', currentPosition: [{ companyName: 'Di LLC' }] },
];

test('skips entirely at zero budget and in dry mode: no network, no spend', async () => {
  const a = apify({ items: ITEMS });
  const r0 = await run(mkdb(), a, { budgetUsd: 0 });
  assert.equal(a.calls.length, 0); assert.equal(r0.spendUsd, 0); assert.match(r0.notes, /skipped/);
  const r1 = await run(mkdb(), a, { dry: true });
  assert.equal(a.calls.length, 0); assert.equal(r1.spendUsd, 0);
});

test('starts the actor with budget-derived limits, the hard charge cap and the token only in a header', async () => {
  const a = apify({ items: ITEMS });
  await run(mkdb({ startPage: 3 }), a);
  const start = a.calls.find((c) => c.method === 'POST');
  assert.match(start.url, /harvestapi~linkedin-profile-search\/runs/);
  assert.equal(new URL(start.url).searchParams.get('maxTotalChargeUsd'), '2');
  assert.ok(!a.calls.some((c) => c.url.includes('SECRET_TOKEN')));
  assert.equal(start.headers.Authorization, 'Bearer SECRET_TOKEN');
  const n = maxItemsFor(2);
  assert.equal(start.body.maxItems, n);
  assert.equal(start.body.takePages, Math.ceil(n / 25));
  assert.equal(start.body.startPage, 3);
  assert.equal(start.body.profileScraperMode, 'Full + email search');
  assert.deepEqual(start.body.companyHeadcount, ['B']);
  assert.ok(start.body.currentJobTitles.includes('Founder'));
});

test('keeps only profiles with a usable email, records actual spend, advances the page cursor', async () => {
  const a = apify({ items: ITEMS, usage: 0.62 });
  const db = mkdb();
  const r = await run(db, a);
  assert.deepEqual(db.s.inserted.map((l) => l.email).sort(), ['ann@buildfast.io', 'di@gmail.com']);
  const ann = db.s.inserted.find((l) => l.email === 'ann@buildfast.io');
  assert.equal(ann.source, 'apify_linkedin'); assert.equal(ann.name, 'Ann Lee'); assert.equal(ann.domain, 'buildfast.io');
  assert.equal(ann.company, 'BuildFast'); assert.equal(ann.title, 'Founder'); assert.equal(ann.linkedin_url, 'https://linkedin.com/in/ann');
  const di = db.s.inserted.find((l) => l.email === 'di@gmail.com');
  assert.equal(di.domain, null); // no company website + free mail: no app domain to scan
  assert.equal(r.spendUsd, 0.62); assert.equal(r.scanned, 4); assert.equal(r.kept, 2);
  assert.equal(db.s.cursor.startPage, 1 + Math.ceil(maxItemsFor(2) / 25));
});

test('a failed run still reports its spend and does not advance the cursor', async () => {
  const a = apify({ items: [], status: 'FAILED', usage: 0.3 });
  const db = mkdb({ startPage: 4 });
  const r = await run(db, a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 0.3);
  assert.equal(db.s.cursor.startPage, 4);
});

test('spend is not lost when the dataset fetch fails after the run was billed; the cursor still advances', async () => {
  const a = apify({ items: [], usage: 1.9, dsStatus: 500 });
  const db = mkdb({ startPage: 2 });
  const r = await run(db, a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 1.9);
  assert.equal(db.s.cursor.startPage, 2 + Math.ceil(maxItemsFor(2) / 25));
});

test('spend is not lost when the DB insert throws after the run was billed', async () => {
  const a = apify({ items: ITEMS, usage: 1.5 });
  const db = mkdb(); db.insertLeads = async () => { throw new Error('supabase down'); };
  const r = await run(db, a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 1.5); assert.match(r.notes, /supabase down/);
});

test('spend is at least the price-list estimate of the items returned when usageTotalUsd under-reports', async () => {
  const a = apify({ items: ITEMS, usage: 0.02 });
  const r = await run(mkdb(), a);
  assert.equal(r.spendUsd, estimateCost(ITEMS.length));
});

// A run that was started may be billed even if we lose the network: assume the full cap was spent.
function flaky({ failPolls = 99, failStartJson = false, usage }) {
  const calls = [];
  const f = async (url, init = {}) => {
    url = String(url); const u = new URL(url);
    calls.push({ url, method: init.method || 'GET' });
    if (init.method === 'POST' && u.pathname.endsWith('/runs')) {
      return failStartJson ? { ok: true, status: 201, json: async () => { throw new Error('socket hang up'); } }
        : new Response(JSON.stringify({ data: { id: 'run1', status: 'RUNNING', defaultDatasetId: 'ds1' } }), { status: 200 });
    }
    if (u.pathname.endsWith('/abort')) return new Response('{}', { status: 200 });
    if (u.pathname === '/v2/actor-runs/run1') throw new Error('network down');
    throw new Error('unexpected ' + url);
  };
  return { f, calls };
}

test('network error while polling a started run: logs the full cap as spent and advances the cursor', async () => {
  const a = flaky({});
  const db = mkdb({ startPage: 2 });
  const r = await run(db, a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 2);
  assert.equal(db.s.cursor.startPage, 2 + Math.ceil(maxItemsFor(2) / 25));
  assert.match(r.notes, /network down/);
});

test('unreadable start response: the run exists, so the cap is assumed spent', async () => {
  const a = flaky({ failStartJson: true });
  const db = mkdb({ startPage: 1 });
  const r = await run(db, a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 2);
  assert.equal(db.s.cursor.startPage, 1 + Math.ceil(maxItemsFor(2) / 25));
});

test('a start request that never got a response is not billed: it throws and the cursor stays', async () => {
  const f = async () => { throw new Error('ECONNREFUSED'); };
  const db = mkdb({ startPage: 5 });
  await assert.rejects(() => run(db, { f }), /ECONNREFUSED/);
  assert.equal(db.s.cursor.startPage, 5);
});

test('ABORTED run with no usage figure and no readable dataset is charged the full cap', async () => {
  const a = apify({ items: [], status: 'ABORTED', usage: null, dsStatus: 500 });
  const r = await run(mkdb(), a);
  assert.equal(r.ok, false); assert.equal(r.spendUsd, 2);
});

test('start request sent but response lost (timeout/reset): the run may exist, so cap is assumed and cursor advances', async () => {
  for (const err of [Object.assign(new Error('timed out'), { name: 'TimeoutError' }), Object.assign(new Error('terminated'), { cause: { code: 'UND_ERR_SOCKET' } }), new Error('socket hang up')]) {
    const db = mkdb({ startPage: 2 });
    const r = await run(db, { f: async () => { throw err; } });
    assert.equal(r.ok, false); assert.equal(r.spendUsd, 2);
    assert.equal(db.s.cursor.startPage, 2 + Math.ceil(maxItemsFor(2) / 25));
  }
});

test('clean connection failures (nothing sent) still throw without moving the cursor', async () => {
  for (const err of [Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }), Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })]) {
    const db = mkdb({ startPage: 5 });
    await assert.rejects(() => run(db, { f: async () => { throw err; } }), /fetch failed/);
    assert.equal(db.s.cursor.startPage, 5);
  }
});

test('every Apify call carries an abort signal so a hung connection cannot block the job', async () => {
  const signals = [];
  const base = apify({ items: ITEMS });
  const f = async (u, init = {}) => { signals.push(init.signal); return base.f(u, init); };
  await run(mkdb(), { f });
  assert.ok(signals.length >= 3);
  assert.ok(signals.every((s) => s instanceof AbortSignal));
});

// 10-19 / 10-20: two runs hit our wait limit, were aborted, had paid for 142 and 113 profiles, and the claw threw the items away
// and booked the whole $20 cap. A timed-out run now keeps what it paid for and books what Apify actually billed.
test('a run we timed out and aborted still ingests the items it produced and books real usage, not the cap', async () => {
  const base = apify({ items: ITEMS, status: 'RUNNING', usage: 0.05, polls: 999 });
  const f = async (u, init = {}) => (String(u).endsWith('/abort') ? new Response('{}', { status: 200 }) : base.f(u, init));
  const db = mkdb({ startPage: 2 });
  const r = await run(db, { f }, { maxWaitMs: -1 });
  assert.match(r.notes, /TIMED-OUT/);
  assert.equal(r.ok, false);
  assert.deepEqual(db.s.inserted.map((l) => l.email).sort(), ['ann@buildfast.io', 'di@gmail.com']);
  assert.equal(r.inserted, 2);
  assert.equal(r.spendUsd, estimateCost(ITEMS.length)); // usage 0.05 under-reports; price list for 4 items wins
  assert.ok(r.spendUsd < 2);
  assert.equal(db.s.cursor.startPage, 2 + Math.ceil(ITEMS.length / 25));
});

test('a timed-out run that produced nothing books reported usage and leaves the cursor', async () => {
  const base = apify({ items: [], status: 'RUNNING', usage: 0.3, polls: 999 });
  const f = async (u, init = {}) => (String(u).endsWith('/abort') ? new Response('{}', { status: 200 }) : base.f(u, init));
  const db = mkdb({ startPage: 4 });
  const r = await run(db, { f }, { maxWaitMs: -1 });
  assert.equal(r.spendUsd, 0.3); assert.equal(db.s.cursor.startPage, 4);
});

test('maxItems is sized to what the wait window can deliver, so the run finishes instead of timing out', async () => {
  const a = apify({ items: ITEMS });
  await run(mkdb(), a, { budgetUsd: 20, maxWaitMs: 30 * 60 * 1000, itemsPerMin: 10 });
  const start = a.calls.find((c) => c.method === 'POST');
  assert.equal(start.body.maxItems, 300);
  assert.equal(start.body.takePages, 12);
  assert.equal(new URL(start.url).searchParams.get('maxTotalChargeUsd'), '20');
});
