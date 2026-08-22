// Cloud Run server. Endpoints:
//   GET  /            health
//   POST /run         trigger the daily build (Cloud Scheduler hits this, OIDC-auth)
//   GET  /approve?t=  HMAC-signed approve/reject from the preview email
import express from "express";
import { config, missingCritical } from "./config.js";
import { runDaily, runVariants, approveBatch, rejectBatch } from "./pipeline.js";
import { verify } from "./lib/sign.js";
import { mountDashboard } from "./dashboard.js";
import { instrumentationHealth } from "./lib/posthog.js";

const app = express();
app.use(express.json());
mountDashboard(app);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    claw: config.clawId,
    offer: config.offer.name,
    counts: config.counts,
    autonomy: config.autonomy,
    missing: missingCritical(),
  });
});

// Scheduler trigger. Runs async; returns immediately so the HTTP call doesn't time out.
app.post("/run", (req, res) => {
  const batchId = req.body?.batchId;
  res.json({ started: true, batchId: batchId || "today" });
  runDaily({ batchId }).catch((e) => console.error("[run] failed:", e));
});

// Daily variant loop — small variations of the sales-proven statics, into the ad
// sets that earned the sales. Its own scheduler job; runs unattended.
// POST /variants?dry=1 to see the copy + plan without writing to Meta.
app.post("/variants", (req, res) => {
  const dryRun = req.query.dry === "1" || req.body?.dryRun === true;
  const batchId = req.body?.batchId;
  res.json({ started: true, dryRun, batchId: batchId || "today" });
  runVariants({ batchId, dryRun }).catch((e) => console.error("[variants] failed:", e));
});

// Is the conversion signal the loop learns from actually there? Surfaced so the
// PostHog Purchase gap is visible instead of silently flattening every ranking.
app.get("/signal", async (_req, res) => {
  try {
    res.json(await instrumentationHealth());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Approve / reject from email.
app.get("/approve", async (req, res) => {
  const payload = verify(req.query.t);
  if (!payload) return res.status(403).send("invalid or tampered link");
  try {
    if (payload.action === "approve") {
      const b = await approveBatch(payload.id);
      return res.send(`<h2>Launched ${b.liveIds?.length || 0} ads for ${b.id}.</h2><p>Budget cap $${config.meta.dailyBudgetCapUsd}/day. AdWatch will monitor.</p>`);
    }
    if (payload.action === "reject") {
      await rejectBatch(payload.id);
      return res.send(`<h2>Rejected ${payload.id}.</h2><p>Nothing launched. Ads remain paused.</p>`);
    }
    return res.status(400).send("unknown action");
  } catch (e) {
    return res.status(500).send(`error: ${e.message}`);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  const m = missingCritical();
  console.log(`[adfactory] listening on ${port}. autonomy=${config.autonomy} offer="${config.offer.name}"`);
  if (m.length) console.warn("[adfactory] MISSING ENV:", m.join(", "));
});
