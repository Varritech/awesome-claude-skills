// Varritech Minute claw — HTTP app (dependency-injected for tests).
// GET /run     -> pick topic, mine claude-mem, research, draft, email approver an approve link
// GET /approve -> validate id+token, send the issue to every lead (single-use)
// GET /preview -> render the most recent pending draft HTML
// GET /health  -> liveness
import express from 'express';
import { renderSubject, renderHtml } from './format.js';
import { pickTopic } from './topics.js';
import { createApprovals } from './approval.js';
import { logClick } from './leads.js';
import { syncClicksToHubspot } from './hubspot-sync.js';

const HISTORY_KEY = 'topic-history';

export function createApp(deps) {
  const {
    store, loadTopics, loadRecentWork, research, generateDraft,
    sendEmail, leads, baseUrl, approverEmail,
    recordClick = logClick,
  } = deps;
  const approvals = createApprovals(store);
  const app = express();

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/run', async (_req, res) => {
    try {
      const [topics, history, proofAssets] = await Promise.all([
        loadTopics(),
        store.get(HISTORY_KEY).then((h) => h || []),
        loadRecentWork(),
      ]);
      const topic = pickTopic(topics, history);
      const researchNotes = await research(topic);
      const draft = await generateDraft({ topic, proofAssets, research: researchNotes });

      const { id, token } = await approvals.createPending({ ...draft, topicName: topic.name });
      await store.set(`latest-pending`, id);

      const approveUrl = `${baseUrl}/approve?id=${id}&token=${token}`;
      const previewHtml = renderHtml(draft);
      await sendEmail({
        to: approverEmail,
        subject: `[DRAFT] ${renderSubject(draft.hook)}`,
        html: `
          <p style="font-family:Arial; font-size:16px;">Newsletter draft ready — topic: <b>${topic.name}</b>.</p>
          <p style="font-family:Arial; font-size:16px;">
            <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">✅ Approve &amp; send to leads</a>
          </p>
          <hr>
          ${previewHtml}`,
      });
      res.json({ id, topic: topic.name, hook: draft.hook });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/approve', async (req, res) => {
    try {
      const { id, token } = req.query;
      let draft;
      try {
        draft = await approvals.approve(id, token);
      } catch (e) {
        const msg = String(e.message || e);
        if (/already/.test(msg)) return res.status(409).send('Already sent.');
        return res.status(/not found/.test(msg) ? 404 : 403).send('Not authorized.');
      }
      const suppressed = new Set(((await store.get('suppressed')) || []).map((e) => e.toLowerCase()));
      const list = (await leads()).filter((to) => !suppressed.has(to.toLowerCase()));
      const subject = renderSubject(draft.hook);
      let sent = 0;
      for (const to of list) {
        const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
        await sendEmail({ to, subject, html: renderHtml(draft, { unsubscribeUrl, email: to, newsletter: draft.topicName }) });
        sent++;
      }
      const history = (await store.get(HISTORY_KEY)) || [];
      await store.set(HISTORY_KEY, [...history, draft.topicName].slice(-50));
      res.send(`Sent "${subject}" to ${sent} leads. ✅`);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: String(e) });
    }
  });

  // Click-tracking redirect. Wrapped CTA links point here; we log the click to
  // ladk email_clicks (attributes to the lead in our own CRM), then 302 to the
  // real destination. Never blocks the redirect on a logging failure.
  app.get('/c', async (req, res) => {
    const dest = String(req.query.u || '');
    const email = String(req.query.e || '').trim().toLowerCase();
    const newsletter = String(req.query.n || '');
    // only redirect to http(s) to avoid open-redirect abuse to other schemes
    if (!/^https?:\/\//i.test(dest)) return res.status(400).send('bad url');
    try {
      await recordClick({ email, newsletter, dest_url: dest, user_agent: req.get('user-agent') || '', ip: (req.get('x-forwarded-for') || '').split(',')[0] });
    } catch (e) {
      console.error('click log failed:', e.message);
    }
    res.redirect(302, dest);
  });

  // Push newsletter clicks into HubSpot contact timelines (own scheduler; clicks
  // trickle in over days). Matches by email, logs a click note, marks synced.
  app.get('/sync-hubspot', async (_req, res) => {
    try {
      const result = await (deps.syncHubspot || syncClicksToHubspot)();
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/unsubscribe', async (req, res) => {
    try {
      const email = String(req.query.email || '').trim();
      if (!email) return res.status(400).send('Missing email.');
      const suppressed = (await store.get('suppressed')) || [];
      if (!suppressed.some((e) => e.toLowerCase() === email.toLowerCase())) {
        await store.set('suppressed', [...suppressed, email]);
      }
      res.send("You're unsubscribed. You won't receive the Varritech Minute again.");
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/preview', async (_req, res) => {
    try {
      const id = await store.get('latest-pending');
      const rec = id ? await store.get(id) : null;
      if (!rec) return res.status(404).send('No pending draft.');
      res.set('Content-Type', 'text/html').send(renderHtml(rec.draft));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return app;
}
