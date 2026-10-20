import test from 'node:test';
import assert from 'node:assert/strict';
import { scrapePage, extractEmails, creditUsage } from '../src/firecrawl.js';

const ok = (data) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fc = (res) => { const calls = []; return { calls, f: async (u, i) => { calls.push({ url: String(u), init: i }); return typeof res === 'function' ? res(u, i) : res; } }; };

test('extractEmails finds plain text and mailto addresses, lowercased, deduped, no asset filenames', () => {
  const md = 'Contact: Hello@Acme.io or [mail us](mailto:founder@acme.io?subject=Hi). Logo logo@2x.png. Again hello@acme.io.';
  assert.deepEqual(extractEmails(md, ['mailto:support@acme.io', 'https://acme.io/x']).sort(), ['founder@acme.io', 'hello@acme.io', 'support@acme.io']);
  assert.deepEqual(extractEmails('', []), []);
});

test('scrapes the main page as markdown+links with the key only in a header, full page (footers carry the emails)', async () => {
  const s = fc(ok({ markdown: 'write to hi@acme.io', links: [], metadata: { title: 'Acme', description: 'We build' } }));
  const r = await scrapePage({ apiKey: 'SECRET', url: 'https://acme.io', fetch: s.f });
  assert.deepEqual(r, { status: 'ok', title: 'Acme', description: 'We build', emails: ['hi@acme.io'] });
  const c = s.calls[0];
  assert.equal(c.url, 'https://api.firecrawl.dev/v1/scrape');
  assert.ok(!c.url.includes('SECRET')); assert.equal(c.init.headers.Authorization, 'Bearer SECRET');
  const body = JSON.parse(c.init.body);
  assert.equal(body.url, 'https://acme.io'); assert.deepEqual(body.formats, ['markdown', 'links']); assert.equal(body.onlyMainContent, false);
  assert.ok(body.waitFor >= 1000);
  assert.ok(c.init.signal instanceof AbortSignal);
});

test('402 means credits are out; 429 means rate limited; other failures are plain errors and never throw', async () => {
  assert.equal((await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: fc(new Response('{}', { status: 402 })).f })).status, 'credits');
  assert.equal((await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: fc(new Response('{}', { status: 429 })).f, sleep: async () => {} })).status, 'rate');
  assert.equal((await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: fc(new Response('{}', { status: 500 })).f })).status, 'error');
  assert.equal((await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: async () => { throw new Error('boom'); } })).status, 'error');
  assert.equal((await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: fc(new Response(JSON.stringify({ success: false, error: 'blocked' }), { status: 200 })).f })).status, 'error');
});

test('a 429 is retried once after a pause before giving up', async () => {
  let n = 0; const slept = [];
  const f = async () => (++n === 1 ? new Response('{}', { status: 429 }) : ok({ markdown: 'x@acme.io', metadata: {} }));
  const r = await scrapePage({ apiKey: 'k', url: 'https://a.io', fetch: f, sleep: async (ms) => slept.push(ms) });
  assert.equal(r.status, 'ok'); assert.equal(slept.length, 1);
});

test('creditUsage returns remaining credits, null when unreadable', async () => {
  assert.equal(await creditUsage({ apiKey: 'k', fetch: fc(new Response(JSON.stringify({ success: true, data: { remaining_credits: 1230, plan_credits: 5000 } }))).f }), 1230);
  assert.equal(await creditUsage({ apiKey: 'k', fetch: async () => { throw new Error('x'); } }), null);
});
