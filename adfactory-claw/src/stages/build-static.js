// STAGE 3b — Build ONE static ad (1080x1350 Meta feed):
//   Hormozi poster copy -> branded HTML -> headless-Chromium screenshot -> upload.
// Two distinct layouts (variant 0 = bold-statement, variant 1 = proof/stack) so the
// 2 daily statics actually test different creative, not the same thing twice.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { editCreative } from "../lib/higgsfield.js";
import { adImagesByHash } from "../lib/graph.js";
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

/*
 * The proven controls this stage varies, newest winner first. Higgsfield EDITS an
 * existing ad rather than inventing a poster: these hashes are the statics with
 * real purchases on act_1058527832767816 (see docs/higgsfield-static-variant-prompts.md).
 * A hash is resolved to a live URL through the adimages endpoint at run time —
 * never a remembered URL, they expire.
 */
const CONTROL_HASHES = (process.env.HF_CONTROL_HASHES ||
  "86db8cd2e9c61b798e462bc19b316ef0,acc13c3002f021aa22d26c5be1f173a0")
  .split(",").map((h) => h.trim()).filter(Boolean);

/*
 * ⛔ Locks the whole layout and permits exactly one change. Copied verbatim from
 * scripts/higgsfield.py, where it is the proven preamble — nano_banana_pro will
 * happily rewrite headline copy without it.
 */
const LOCK =
  "This is an existing finished advertisement. Keep it EXACTLY as it is: identical " +
  "layout, identical composition, identical framing, identical fonts, identical " +
  "colours, identical spacing, identical logo. Reproduce every text label, number and " +
  "word EXACTLY as in the source, character for character, with no rewording and no " +
  "new text anywhere. Do not crop, do not zoom, do not re-render the layout. " +
  "Change ONE thing only: ";

// One visual lever per variant — the copy levers live in stages/variants.js.
const LEVERS = [
  "the flat background becomes a deep near-black charcoal. KEEP all text character for character.",
  "the background becomes a soft warm off-white and the type stays its existing colour. KEEP all text character for character.",
  "a subtle vertical gradient replaces the flat background, darkest at the bottom. KEEP all text character for character.",
  "the accent colour used for the highlight becomes a brighter lime. KEEP all text character for character.",
];

async function higgsfieldStatic({ dir, variant }) {
  const hash = CONTROL_HASHES[variant % CONTROL_HASHES.length];
  const [img] = await adImagesByHash([hash]);
  if (!img?.url) throw new Error(`no live URL for control hash ${hash}`);

  const outUrl = await editCreative(img.url, LOCK + LEVERS[variant % LEVERS.length]);

  // Pull the result down so it is uploaded to our own bucket — the Higgsfield
  // CDN URL is not something a live ad should depend on.
  const res = await fetch(outUrl);
  if (!res.ok) throw new Error(`higgsfield fetch ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());

  /*
   * ⛔ Name the file for what it CONTAINS. Higgsfield returns a JPEG
   * (`..._resize.jpg`); writing those bytes to `ad.png` and uploading them as
   * image/png hands Meta a file whose extension, Content-Type and magic bytes
   * all disagree. Sniff the magic number instead of trusting either the URL or
   * the previous stage's habit of always saying PNG.
   */
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50;
  const out = path.join(dir, isPng ? "ad.png" : "ad.jpg");
  fs.writeFileSync(out, bytes);
  return out;
}

export async function buildStatic({ batchId, variant, copy }) {
  const dir = path.join(config.workdir, `${batchId}-static-${variant}`);
  fs.mkdirSync(dir, { recursive: true });
  const poster = copy.staticPoster || {
    headline: copy.hookLines.join(" "),
    subhead: copy.meta.primaryText,
    cta: copy.endCardCta,
  };
  /*
   * Higgsfield is the generator (standing rule: creative is never silently
   * substituted). The HTML+Chromium poster remains ONLY as a fallback — losing a
   * day's creative because an image API had a bad minute is worse than shipping
   * the older-style poster, and the failure is logged loudly either way.
   */
  let png;
  try {
    png = await higgsfieldStatic({ dir, variant });
  } catch (e) {
    console.error("[static] higgsfield failed, falling back to HTML render:", e.message);
    const htmlPath = path.join(dir, "ad.html");
    fs.writeFileSync(htmlPath, posterHtml(poster, variant));
    png = path.join(dir, "ad.png");
    await screenshot(htmlPath, png);
  }
  const ext = path.extname(png) === ".jpg" ? "jpg" : "png";
  const url = await uploadPublic(
    png,
    `${config.gcs.prefix}/${batchId}/static-${variant}.${ext}`,
    ext === "jpg" ? "image/jpeg" : "image/png",
  );
  return { kind: "static", variant, imageUrl: url, posterUrl: url, copy };
}
