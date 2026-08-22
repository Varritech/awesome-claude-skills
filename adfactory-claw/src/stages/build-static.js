// STAGE 3b — Build ONE static ad (1080x1350 Meta feed):
//   Hormozi poster copy -> branded HTML -> headless-Chromium screenshot -> upload.
// Two distinct layouts (variant 0 = bold-statement, variant 1 = proof/stack) so the
// 2 daily statics actually test different creative, not the same thing twice.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { sh } from "../lib/sh.js";
import { uploadPublic } from "../lib/gcs.js";

const W = 1080, H = 1350;

function posterHtml({ headline, subhead, cta }, variant) {
  const b = config.offer.brand;
  const accent = b.accent, indigo = b.indigoDeep, electric = b.electricIndigo;
  const bg =
    variant === 0
      ? `radial-gradient(circle at 30% 20%, ${electric} 0%, ${indigo} 70%)`
      : `linear-gradient(160deg, ${indigo} 0%, #0a0118 100%)`;
  const headSize = variant === 0 ? 118 : 96;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Anton&display=swap');
  *{margin:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;background:${bg};color:#fff;font-family:'Chakra Petch',sans-serif;
       display:flex;flex-direction:column;justify-content:center;padding:96px 80px;overflow:hidden}
  .kicker{font-size:30px;letter-spacing:6px;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:28px}
  .head{font-family:'Anton',sans-serif;font-size:${headSize}px;line-height:0.94;text-transform:uppercase;
        -webkit-text-stroke:0;color:#fff}
  .head .hl{color:${accent}}
  .sub{font-size:38px;line-height:1.3;color:#d9d2ee;margin-top:36px;max-width:880px;font-weight:500}
  .cta{margin-top:64px;display:inline-block;align-self:flex-start;background:${accent};color:${indigo};
       font-weight:700;font-size:40px;text-transform:uppercase;padding:26px 52px;border-radius:18px;letter-spacing:1px}
  .url{position:absolute;bottom:64px;left:80px;font-size:30px;color:#cdbff5;letter-spacing:1px}
  .badge{position:absolute;top:64px;right:80px;font-size:26px;color:${accent};border:2px solid ${accent};
         border-radius:999px;padding:10px 22px;font-weight:600}
</style></head><body>
  <div class="badge">70+ SKILLS</div>
  <div class="kicker">${config.offer.name}</div>
  <div class="head">${headline.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>')}</div>
  <div class="sub">${subhead}</div>
  <div class="cta">${cta}</div>
  <div class="url">${config.offer.url.replace(/^https?:\/\//, "")}</div>
</body></html>`;
}

async function screenshot(htmlPath, outPath) {
  // Resolve a chromium binary: explicit CHROMIUM_BIN (set to /usr/bin/chromium in
  // the image), else a glob (puppeteer cache), else PATH "chromium". A glob value
  // is expanded; a plain path is used as-is.
  const want = process.env.CHROMIUM_BIN || "chromium";
  let bin = want;
  if (want.includes("*")) {
    bin = (await sh("bash", ["-lc", `ls -1 ${want} 2>/dev/null | head -1`], { capture: true })).trim() || "chromium";
  }
  await sh(bin, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${outPath}`,
    `file://${htmlPath}`,
  ]);
}

export async function buildStatic({ batchId, variant, copy }) {
  const dir = path.join(config.workdir, `${batchId}-static-${variant}`);
  fs.mkdirSync(dir, { recursive: true });
  const poster = copy.staticPoster || {
    headline: copy.hookLines.join(" "),
    subhead: copy.meta.primaryText,
    cta: copy.endCardCta,
  };
  const htmlPath = path.join(dir, "ad.html");
  fs.writeFileSync(htmlPath, posterHtml(poster, variant));
  const png = path.join(dir, "ad.png");
  await screenshot(htmlPath, png);
  const url = await uploadPublic(png, `${config.gcs.prefix}/${batchId}/static-${variant}.png`, "image/png");
  return { kind: "static", variant, imageUrl: url, posterUrl: url, copy };
}
