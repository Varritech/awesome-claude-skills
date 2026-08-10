import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

function fakeDeps() {
  const sent = [];
  const clicks = [];
  const opens = [];
  const texts = [];
  const m = new Map();
  return {
    sent,
    clicks,
    opens,
    texts,
    deps: {
      store: {
        get: async (k) => m.get(k) ?? null,
        set: async (k, v) => void m.set(k, v),
      },
      loadTopics: async () => [{ name: 'claw-case-studies', desc: 'claw stories' }],
      loadRecentWork: async () => ['[feature] AdWatch claw auto-killed $283 ad'],
      research: async () => 'agents are hot in 2026',
      generateDraft: async () => ({
        hook: 'The $283 lesson',
        paragraphs: ['We burned $283.'],
        steps: ['Watched', 'Killed'],
        cta: { text: 'OpenClaw', url: 'https://varritech.com/openclaw' },
      }),
      sendEmail: async (args) => void sent.push(args),
      leads: async () => ['lead1@example.com', 'lead2@example.com'],
      baseUrl: 'https://claw.example.com',
      approverEmail: 'christian@varritech.com',
      recordClick: async (args) => void clicks.push(args),
      recordOpen: async (args) => void opens.push(args),
      notifyText: async (args) => void texts.push(args),
      notifyOpen: async (args) => void texts.push(args),
    },
  };
}

async function listen(app) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('/run drafts the issue and emails ONLY the approver with an approve link', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/run`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'christian@varritech.com');
    assert.match(sent[0].subject, /DRAFT.*Varritech Minute: The \$283 lesson/);
    assert.match(sent[0].html, /\/approve\?id=.*&token=/);
    assert.ok(body.id);
  } finally {
    server.close();
  }
});

test('/approve with the emailed token sends to every lead, once', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    await fetch(`${base}/run`);
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    assert.ok(m, 'approve link present');
    sent.length = 0;
    const res = await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map((s) => s.to).sort(), ['lead1@example.com', 'lead2@example.com']);
    assert.equal(sent[0].subject, 'Varritech Minute: The $283 lesson');
    // second click = no resend
    const again = await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.equal(again.status, 409);
    assert.equal(sent.length, 2);
  } finally {
    server.close();
  }
});

test('/approve with a bad token sends nothing', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    await fetch(`${base}/run`);
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)/);
    sent.length = 0;
    const res = await fetch(`${base}/approve?id=${m[1]}&token=deadbeef`);
    assert.equal(res.status, 403);
    assert.equal(sent.length, 0);
  } finally {
    server.close();
  }
});

test('/unsubscribe suppresses the lead and /approve never emails them; unsubscribe link is per-recipient', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const u = await fetch(`${base}/unsubscribe?email=lead1%40example.com`);
    assert.equal(u.status, 200);
    await fetch(`${base}/run`);
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'lead2@example.com');
    assert.match(sent[0].html, /\/unsubscribe\?email=lead2%40example\.com/);
    assert.doesNotMatch(sent[0].html, /\{\{unsubscribe_url\}\}/);
  } finally {
    server.close();
  }
});

test('/c logs the click AND texts a notification, then redirects to the real destination', async () => {
  const { deps, clicks, texts } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(
      `${base}/c?e=lead1%40example.com&u=${encodeURIComponent('https://varritech.com/openclaw')}&n=claw-case-studies`,
      { redirect: 'manual' }
    );
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://varritech.com/openclaw');
    assert.equal(clicks.length, 1);
    assert.equal(clicks[0].email, 'lead1@example.com');
    assert.equal(clicks[0].dest_url, 'https://varritech.com/openclaw');
    assert.equal(texts.length, 1);
    assert.equal(texts[0].email, 'lead1@example.com');
    assert.equal(texts[0].dest_url, 'https://varritech.com/openclaw');
    assert.equal(texts[0].newsletter, 'claw-case-studies');
  } finally {
    server.close();
  }
});

test('/c rejects non-http(s) destinations and never texts or logs', async () => {
  const { deps, clicks, texts } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/c?e=lead1%40example.com&u=${encodeURIComponent('javascript:alert(1)')}`, {
      redirect: 'manual',
    });
    assert.equal(res.status, 400);
    assert.equal(clicks.length, 0);
    assert.equal(texts.length, 0);
  } finally {
    server.close();
  }
});

test('/c still redirects even when the SMS notify fails (never blocks the click)', async () => {
  const { deps, clicks } = fakeDeps();
  deps.notifyText = async () => { throw new Error('quo down'); };
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(
      `${base}/c?e=lead1%40example.com&u=${encodeURIComponent('https://varritech.com/openclaw')}`,
      { redirect: 'manual' }
    );
    assert.equal(res.status, 302);
    assert.equal(clicks.length, 1);
  } finally {
    server.close();
  }
});

test('/o serves a 1x1 GIF pixel, logs the open, AND texts a notification', async () => {
  const { deps, opens, texts } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/o?e=lead1%40example.com&n=claw-case-studies`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/gif');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0);
    assert.equal(opens.length, 1);
    assert.equal(opens[0].email, 'lead1@example.com');
    assert.equal(opens[0].newsletter, 'claw-case-studies');
    assert.equal(texts.length, 1);
    assert.equal(texts[0].email, 'lead1@example.com');
    assert.equal(texts[0].newsletter, 'claw-case-studies');
  } finally {
    server.close();
  }
});

test('/o always returns the pixel even when logging the open throws', async () => {
  const { deps } = fakeDeps();
  deps.recordOpen = async () => { throw new Error('db down'); };
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/o?e=lead1%40example.com`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/gif');
  } finally {
    server.close();
  }
});

test('/o always returns the pixel even when the open-SMS notify throws', async () => {
  const { deps } = fakeDeps();
  deps.notifyOpen = async () => { throw new Error('quo down'); };
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/o?e=lead1%40example.com`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/gif');
  } finally {
    server.close();
  }
});

test('/run?edition=... binds that edition audience to the draft; /approve sends there, not to the broadcast list', async () => {
  const { deps, sent } = fakeDeps();
  deps.resolveAudience = async (edition) =>
    edition === 'scalewright-inner-circle'
      ? ['angus@vulcan-adv.com', 'thebizhive@proton.me']
      : ['lead1@example.com', 'lead2@example.com'];
  const { server, base } = await listen(createApp(deps));
  try {
    const run = await fetch(`${base}/run?edition=scalewright-inner-circle`);
    assert.equal((await run.json()).edition, 'scalewright-inner-circle');
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.deepEqual(sent.map((s) => s.to).sort(), ['angus@vulcan-adv.com', 'thebizhive@proton.me']);
  } finally {
    server.close();
  }
});

test('/run with no edition still goes to the default broadcast audience', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const run = await fetch(`${base}/run`);
    assert.equal((await run.json()).edition, 'varritech-minute');
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.deepEqual(sent.map((s) => s.to).sort(), ['lead1@example.com', 'lead2@example.com']);
  } finally {
    server.close();
  }
});

// Tracking key: the default broadcast keeps using the bare topic name so existing
// email_clicks/email_opens rows stay comparable; a non-default edition is namespaced
// so Inner Circle engagement never blends into Varritech Minute's numbers.
test('tracking links carry the edition for a non-default edition, and stay bare for the default', async () => {
  const { deps, sent } = fakeDeps();
  deps.resolveAudience = async () => ['angus@vulcan-adv.com'];
  const { server, base } = await listen(createApp(deps));
  try {
    await fetch(`${base}/run?edition=scalewright-inner-circle`);
    let m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.match(sent[0].html, /[?&]n=scalewright-inner-circle%3Aclaw-case-studies/);
  } finally {
    server.close();
  }

  const plain = fakeDeps();
  const s2 = await listen(createApp(plain.deps));
  try {
    await fetch(`${s2.base}/run`);
    const m2 = plain.sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    plain.sent.length = 0;
    await fetch(`${s2.base}/approve?id=${m2[1]}&token=${m2[2]}`);
    assert.match(plain.sent[0].html, /[?&]n=claw-case-studies/);
    assert.doesNotMatch(plain.sent[0].html, /varritech-minute%3A/);
  } finally {
    s2.server.close();
  }
});

// Merge gate: the masthead must survive the WHOLE path to the sent payload, not
// just renderSubject(). A draft that renders "Scalewright Inner Circle" but ships
// as "Varritech Minute" looks done and isn't.
test('the Inner Circle masthead reaches the approver draft AND the sent issue', async () => {
  const { deps, sent } = fakeDeps();
  deps.resolveAudience = async () => ['angus@vulcan-adv.com'];
  const { server, base } = await listen(createApp(deps));
  try {
    await fetch(`${base}/run?edition=scalewright-inner-circle`);
    assert.match(sent[0].subject, /^\[DRAFT\] Scalewright Inner Circle: The \$283 lesson$/);
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    const res = await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.equal(sent[0].subject, 'Scalewright Inner Circle: The $283 lesson');
    assert.match(await res.text(), /Scalewright Inner Circle/);
  } finally {
    server.close();
  }
});

test('/run rejects an unknown edition and drafts nothing', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    const res = await fetch(`${base}/run?edition=scaleright-inner-circle`);
    assert.equal(res.status, 400);
    assert.equal(sent.length, 0);
  } finally {
    server.close();
  }
});

test('/approve emails include an open-tracking pixel unique per recipient', async () => {
  const { deps, sent } = fakeDeps();
  const { server, base } = await listen(createApp(deps));
  try {
    await fetch(`${base}/run`);
    const m = sent[0].html.match(/approve\?id=([a-f0-9]+)&(?:amp;)?token=([a-f0-9]+)/);
    sent.length = 0;
    await fetch(`${base}/approve?id=${m[1]}&token=${m[2]}`);
    assert.equal(sent.length, 2);
    const lead1Mail = sent.find((s) => s.to === 'lead1@example.com');
    const lead2Mail = sent.find((s) => s.to === 'lead2@example.com');
    assert.match(lead1Mail.html, /\/o\?e=lead1%40example\.com/);
    assert.match(lead2Mail.html, /\/o\?e=lead2%40example\.com/);
    assert.notEqual(
      lead1Mail.html.match(/\/o\?[^"]+/)[0],
      lead2Mail.html.match(/\/o\?[^"]+/)[0]
    );
  } finally {
    server.close();
  }
});
