// Small dashboard at /dashboard — see every generated batch + its assets (video
// posters that play, static images, frame-check strips), status, and act:
// Build now, Approve, Reject. No login (link-only, like the other claw dashboards).
import { config } from "./config.js";
import { listBatchIds, loadBatch } from "./lib/state.js";
import { sign } from "./lib/sign.js";

const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

function adCard(ad) {
  const media =
    ad.kind === "video"
      ? `<video src="${esc(ad.mp4Url)}" poster="${esc(ad.posterUrl)}" controls preload="none"
           style="width:100%;border-radius:10px;background:#000;aspect-ratio:9/16;object-fit:cover"></video>`
      : `<a href="${esc(ad.imageUrl)}" target="_blank"><img src="${esc(ad.imageUrl)}"
           style="width:100%;border-radius:10px;display:block"/></a>`;
  const strip = ad.stripUrl
    ? `<a href="${esc(ad.stripUrl)}" target="_blank" class="link">frame-check strip ↗</a>`
    : "";
  const stagedBadge = ad.staged
    ? `<span class="badge ok">staged (paused)</span>`
    : `<span class="badge warn">not staged</span>`;
  const m = ad.copy?.meta || {};
  return `
  <div class="ad">
    <div class="media">${media}</div>
    <div class="meta">
      <div class="tag">${esc(ad.kind)} #${(ad.variant ?? 0) + 1} ${stagedBadge}</div>
      ${ad.angle ? `<div class="angle">${esc(ad.angle)}</div>` : ""}
      <div class="head">${esc(m.headline)}</div>
      <div class="primary">${esc(m.primaryText)}</div>
      ${strip}
    </div>
  </div>`;
}

function batchCard(b) {
  const sigA = sign({ id: b.id, action: "approve" });
  const sigR = sign({ id: b.id, action: "reject" });
  const statusClass = { live: "ok", rejected: "warn", pending: "" }[b.status] || "";
  const actions =
    b.status === "pending"
      ? `<a class="btn go" href="/approve?t=${encodeURIComponent(sigA)}">Approve &amp; launch</a>
         <a class="btn no" href="/approve?t=${encodeURIComponent(sigR)}">Reject</a>`
      : b.status === "live"
      ? `<span class="badge ok">LIVE — ${(b.liveIds || []).length} ads</span>`
      : `<span class="badge warn">${esc(b.status)}</span>`;
  return `
  <section class="batch">
    <header>
      <h2>${esc(b.id)} <span class="badge ${statusClass}">${esc(b.status || "pending")}</span></h2>
      <div class="act">${actions}</div>
    </header>
    <div class="grid">${(b.ads || []).map(adCard).join("")}</div>
  </section>`;
}

export function mountDashboard(app) {
  app.get("/dashboard", async (_req, res) => {
    let batches = [];
    try {
      const ids = await listBatchIds(30);
      batches = (await Promise.all(ids.map(loadBatch))).filter(Boolean);
    } catch (e) {
      console.error("[dashboard]", e.message);
    }
    const body =
      batches.length === 0
        ? `<p class="empty">No batches yet. Hit <b>Build now</b> or wait for the 8am ET run.</p>`
        : batches.map(batchCard).join("");
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>AdFactory</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#0c0a14;--card:#15111f;--line:#2a2438;--accent:#99FF32;--ink:#ece8f5;--mut:#9b91b5}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
  .top{position:sticky;top:0;background:#0c0a14ee;backdrop-filter:blur(8px);border-bottom:1px solid var(--line);
       padding:16px 24px;display:flex;align-items:center;gap:16px;z-index:10}
  .top h1{font-size:18px;margin:0;letter-spacing:.5px}
  .top .sub{color:var(--mut);font-size:13px}
  .build{margin-left:auto;background:var(--accent);color:#190336;font-weight:700;border:0;border-radius:8px;
         padding:10px 18px;cursor:pointer;font-size:14px}
  .build:disabled{opacity:.5;cursor:wait}
  main{max-width:1100px;margin:0 auto;padding:24px}
  .empty{color:var(--mut);text-align:center;padding:60px}
  .batch{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin:0 0 24px}
  .batch header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
  .batch h2{font-size:16px;margin:0;display:flex;gap:10px;align-items:center}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
  .ad{background:#0c0a14;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .ad .media{padding:8px} .ad .meta{padding:4px 12px 14px}
  .tag{font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .angle{font-size:12px;color:var(--mut);font-style:italic;margin-bottom:6px}
  .head{font-weight:700;font-size:14px;margin-bottom:4px}
  .primary{font-size:12px;color:var(--mut);white-space:pre-line;max-height:84px;overflow:auto}
  .link{display:inline-block;margin-top:8px;color:var(--accent);font-size:12px;text-decoration:none}
  .badge{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--mut)}
  .badge.ok{color:var(--accent);border-color:var(--accent)}
  .badge.warn{color:#ff7a7a;border-color:#5a2630}
  .btn{display:inline-block;text-decoration:none;font-weight:700;font-size:13px;padding:9px 16px;border-radius:8px;margin-left:8px}
  .btn.go{background:var(--accent);color:#190336} .btn.no{background:#3a1620;color:#ff9a9a}
</style></head><body>
  <div class="top">
    <h1>AdFactory <span class="sub">${esc(config.offer.name)} · ${config.counts.video}v + ${config.counts.static}s/day · cap $${config.meta.dailyBudgetCapUsd} · ${esc(config.autonomy)}</span></h1>
    <button class="build" onclick="build(this)">Build now</button>
  </div>
  <main>${body}</main>
  <script>
    async function build(btn){
      btn.disabled=true; btn.textContent='Building… (~5 min)';
      try{ await fetch('/run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
           btn.textContent='Started — refresh in a few min'; }
      catch(e){ btn.textContent='Failed'; btn.disabled=false; }
    }
  </script>
</body></html>`);
  });
}
