import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, sendReport } from '../src/report.js';

const counts = {
  total: 120, unsent: 118, bySource: { github: 100, apify_linkedin: 20 }, newToday: { github: 30, apify_linkedin: 5 },
  spendToday: 0.62, spendMonth: 1.5, githubScanned: 40, githubScannedTotal: 840, errors: [],
};

test('report states the numbers in plain short sentences', () => {
  const { subject, text } = buildReport(counts, { today: '2026-10-19' });
  assert.match(subject, /Lovable leads/); assert.match(subject, /2026-10-19/);
  assert.match(text, /GitHub: 30 new/); assert.match(text, /LinkedIn: 5 new/);
  assert.match(text, /120 leads in total/); assert.match(text, /118 not yet contacted/);
  assert.match(text, /\$0\.62 today/); assert.match(text, /\$1\.50 this month/);
  assert.match(text, /840 of about 78,000 repos/);
  assert.match(text, /No errors/);
});

test('report lists errors', () => {
  const { text } = buildReport({ ...counts, errors: ['github: boom'] }, { today: '2026-10-19' });
  assert.match(text, /Errors: github: boom/);
  assert.doesNotMatch(text, /No errors/);
});

const cfg = (f) => ({ apiKey: 'K', userId: 'u', to: 'a@b.co', fetch: f });

test('sendReport posts the Composio GMAIL_SEND_EMAIL shape', async () => {
  let seen;
  const f = async (url, init) => { seen = { url: String(url), init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ successful: true }), { status: 200 }); };
  await sendReport(cfg(f), { subject: 's', text: 't' });
  assert.match(seen.url, /tools\/execute\/GMAIL_SEND_EMAIL$/);
  assert.equal(seen.init.headers['x-api-key'], 'K');
  assert.deepEqual(seen.body.arguments, { recipient_email: 'a@b.co', subject: 's', body: 't', is_html: false });
  assert.equal(seen.body.user_id, 'u');
});

test('successful:false is an error even on HTTP 200', async () => {
  const f = async () => new Response(JSON.stringify({ successful: false, error: 'no auth' }), { status: 200 });
  await assert.rejects(() => sendReport(cfg(f), { subject: 's', text: 't' }), /not sent.*no auth/);
});
