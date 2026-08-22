// STAGE 4 — Daily preview email with approve/reject links (gate mode).
import { config } from "../config.js";
import { sendMail } from "../lib/email.js";
import { sign } from "../lib/sign.js";

function adBlock(ad) {
  const img = ad.kind === "video" ? ad.posterUrl : ad.imageUrl;
  const strip = ad.stripUrl
    ? `<p style="margin:8px 0"><a href="${ad.stripUrl}">frame-check strip (source vs render)</a></p>`
    : "";
  const vid = ad.kind === "video" ? `<p style="margin:8px 0"><a href="${ad.mp4Url}">play video</a></p>` : "";
  const staged = ad.staged
    ? `<span style="color:#1a7f37">staged to Meta (paused)</span>`
    : `<span style="color:#b30000">NOT staged${ad.error ? ": " + ad.error : ""} — attach manually</span>`;
  return `
  <table style="width:100%;border:1px solid #e2e2e2;border-radius:10px;margin:14px 0">
    <tr>
      <td style="width:300px;vertical-align:top;padding:14px">
        <img src="${img}" style="width:280px;border-radius:8px;display:block" />
      </td>
      <td style="vertical-align:top;padding:14px;font-family:Arial,sans-serif">
        <div style="font-weight:700;font-size:15px">${ad.kind.toUpperCase()} #${ad.variant + 1}</div>
        <div style="color:#555;font-size:13px;margin:6px 0">${ad.angle || ""}</div>
        <div style="font-size:14px"><b>${ad.copy.meta.headline}</b></div>
        <div style="white-space:pre-line;color:#333;font-size:13px;margin:6px 0">${ad.copy.meta.primaryText}</div>
        ${vid}${strip}
        <div style="font-size:12px;margin-top:6px">${staged}</div>
      </td>
    </tr>
  </table>`;
}

export async function sendPreview({ batch }) {
  const base = config.publicBaseUrl;
  const approve = `${base}/approve?t=${encodeURIComponent(sign({ id: batch.id, action: "approve" }))}`;
  const reject = `${base}/approve?t=${encodeURIComponent(sign({ id: batch.id, action: "reject" }))}`;
  const blocks = batch.ads.map(adBlock).join("");
  const html = `
  <div style="max-width:720px;margin:0 auto;font-family:Arial,sans-serif">
    <h2 style="font-family:Arial">AdFactory — ${batch.id}</h2>
    <p>${batch.ads.length} ads built for <b>${config.offer.name}</b>: ${config.counts.video} video + ${config.counts.static} static.
    Daily budget cap $${config.meta.dailyBudgetCapUsd}. Review, then:</p>
    <p>
      <a href="${approve}" style="background:#1a7f37;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Approve &amp; launch all</a>
      &nbsp;&nbsp;
      <a href="${reject}" style="background:#b30000;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Reject</a>
    </p>
    ${blocks}
    <p style="color:#888;font-size:12px">Links expire only if APPROVE_SECRET rotates. Ads stay PAUSED until you approve.</p>
  </div>`;
  await sendMail({ subject: `AdFactory ${batch.id}: ${batch.ads.length} ads ready to launch`, html });
}

export async function sendLaunchedReport({ batch, liveIds }) {
  const html = `<div style="font-family:Arial"><h3>AdFactory ${batch.id} — LIVE</h3>
  <p>${liveIds.length} ads set ACTIVE under adset ${batch.adsetId}. Budget cap $${config.meta.dailyBudgetCapUsd}/day.</p>
  <p>AdWatch claw will monitor + auto-kill waste.</p></div>`;
  await sendMail({ subject: `AdFactory ${batch.id}: launched ${liveIds.length} ads`, html });
}
