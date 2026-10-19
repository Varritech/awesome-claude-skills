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

function apify({ items, status = 'SUCCEEDED', usage = 0.62, polls = 2 }) {
  const calls = [];
  let polled = 0;
  const f = async (url, init = {}) => {
    url = String(url); const u = new URL(url);
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined });
    const json = (b) => new Response(JSON.stringify(b), { status: 200 });
    if (init.method === 'POST' && u.pathname.endsWith('/runs')) return json({ data: { id: 'run1', status: 'RUNNING', defaultDatasetId: 'ds1' } });
    if (u.pathname === '/v2/actor-runs/run1') { polled++; return json({ data: { id: 'run1', status: polled >= polls ? status : 'RUNNING', usageTotalUsd: usage, defaultDatasetId: 'ds1' } }); }
    if (u.pathname === '/v2/datasets/ds1/items') return json(items);
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
  assert.equal(di.domain, 'gmail.com'); // no company website: email domain per spec
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
