// DAILY VARIANT LOOP — the autopilot.
//
// Once a day: find the static ads that have actually produced sales, generate small
// variations of them with fresh Hormozi copy, ship those into the ad sets that
// EARNED the sales, and retire the variants that have proven they don't work.
//
// Two doctrines from this account's own P&L are hard-coded here, because breaking
// either has already cost real money:
//
//  1. ⛔ NEVER duplicate a winner into a new campaign/ad set. On 2026-08-17 the
//     winners were copied into a fresh "WINNERS Consolidated" ad set at $300/day:
//     the copy burned $309 for 0 purchases while the starved ORIGINAL took $28 and
//     the pair had earned $493 on $99 three days earlier. A copied ad is a new ad id
//     with zero conversion history inside an ad set with zero optimization record.
//     So: variants are ADDED to the earning ad set. Never a new ad set, never a
//     budget change.
//
//  2. ⛔ Conversion volume, not money, is the constraint. At ~4 purchases/week the
//     optimizer cannot separate signal from noise. Flooding an earning ad set with
//     new zero-history creative triggers Meta's front-runner bias against the proven
//     ad. Hence MAX_NEW_PER_ADSET and MAX_LIVE_VARIANTS — the loop is a trickle, not
//     a firehose, and it retires before it adds.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import { askJSON } from "../lib/anthropic.js";
import { sh } from "../lib/sh.js";
import {
  adInsights,
  activeAdsets,
  getObject,
  uploadImageBytes,
  createImageCreative,
  createAd,
  setAdStatus,
} from "../lib/graph.js";
import { bestAvailableSignal, rankAdsBySignal, instrumentationHealth } from "../lib/posthog.js";

// Every ad this loop creates is named with this prefix. It is the ONLY thing that
// makes an ad eligible for automatic pausing — the loop must never be able to touch
// a human-made ad, whatever the numbers say.
const OWNED_PREFIX = "Ad | AUTO |";

const MAX_NEW_PER_ADSET = Number(process.env.VARIANTS_MAX_NEW_PER_ADSET || 2);
const MAX_LIVE_VARIANTS = Number(process.env.VARIANTS_MAX_LIVE_PER_ADSET || 6);
// A variant gets killed once it has had a fair shot: enough spend to have bought
// roughly one conversion at target CPA, with nothing to show.
const RETIRE_SPEND_USD = Number(process.env.VARIANTS_RETIRE_SPEND_USD || 60);

// What counts as "this ad worked" depends on the offer.
//
// The claw sells varritech.com now — the agency — and the conversion is a booked
// discovery call, not a checkout. Counting purchases against a lead funnel returns
// zero for every ad, which reads exactly like "no creative works" and would make
// the loop silently refuse to run forever.
//
// ⛔ `lead` and `offsite_conversion.fb_pixel_lead` are the SAME conversion counted
// twice by Meta, and so are `complete_registration` and its pixel twin — hence the
// max-per-family instead of a sum. The agency's own history uses both families:
// the best ad on the account (OpenClaw White Collar, 14 leads at $10.64) reports
// `lead`, while the Schedule/Quick-Build ads report `complete_registration`.
const ACTION_FAMILIES = {
  purchase: [["purchase", "offsite_conversion.fb_pixel_purchase"]],
  lead: [
    ["lead", "offsite_conversion.fb_pixel_lead"],
    ["complete_registration", "offsite_conversion.fb_pixel_complete_registration"],
    ["schedule_total"],
  ],
};

function conversionsOf(row, goal = config.offer.goal) {
  const families = ACTION_FAMILIES[goal] || ACTION_FAMILIES.purchase;
  const pick = (list, family) => {
    let n = 0;
    for (const a of list || []) if (family.includes(a.action_type)) n = Math.max(n, +a.value || 0);
    return n;
  };
  let conversions = 0;
  let value = 0;
  for (const family of families) {
    conversions += pick(row.actions, family);
    value += pick(row.action_values, family);
  }
  return { conversions, value };
}

/**
 * The ads worth varying: static image ads with attributed conversions that sit in
 * an ad set which is LIVE right now.
 *
 * ⛔ "Live right now" is the whole safety property. A winner in a paused ad set is
 * NOT a target — varying it would mean standing the ad set back up, and creating
 * an ad set is a spend decision the claw must never make unattended (doctrine #1).
 *
 * As of 2026-08-21 that means this returns EMPTY for the agency offer: every
 * varritech.com campaign on the account is paused, so the loop correctly no-ops
 * and says so rather than inventing somewhere to spend. Set
 * `VARIANTS_TARGET_ADSET_ID` (or activate an agency ad set) to give it a home.
 */
export async function findProvenStatics() {
  const [rows, live] = await Promise.all([adInsights({ datePreset: "last_90d" }), activeAdsets()]);
  const liveById = new Map(live.map((a) => [a.id, a]));

  // An explicitly named ad set is a human saying "this one is live, use it" — it
  // counts as a target even if the ACTIVE sweep hasn't caught up.
  const pinned = config.meta.variantsTargetAdsetId;
  const isLive = (adsetId) => liveById.has(adsetId) || adsetId === pinned;

  const earners = rows
    .map((r) => ({ ...r, ...conversionsOf(r) }))
    .filter((r) => r.conversions > 0 && isLive(r.adset_id))
    // never treat the loop's own output as a source to copy from
    .filter((r) => !String(r.ad_name).startsWith(OWNED_PREFIX));

  const out = [];
  for (const r of earners) {
    const ad = await getObject(
      r.ad_id,
      "name,creative{id,image_hash,object_story_spec,effective_object_story_id}",
    );
    const oss = ad.creative?.object_story_spec || {};
    const ld = oss.link_data || {};
    const isStatic = Boolean(ad.creative?.image_hash || ld.image_hash) && !ld.child_attachments && !oss.video_data;
    if (!isStatic) continue;
    // ⛔ Sells THIS offer, not merely "converted something". Without this the
    // lead-goal filter matches the Skills checkout's CompleteRegistration events
    // and the loop cheerfully varies a product ad into a product ad set.
    const link = ld.link || "";
    if (config.offer.linkMatch && !link.includes(config.offer.linkMatch)) continue;
    out.push({
      adId: r.ad_id,
      adName: r.ad_name,
      adsetId: r.adset_id,
      adsetName: r.adset_name,
      spend: +r.spend || 0,
      conversions: r.conversions,
      value: r.value,
      costPerConversion: r.conversions ? (+r.spend || 0) / r.conversions : null,
      imageHash: ad.creative?.image_hash || ld.image_hash,
      control: {
        message: ld.message || "",
        headline: ld.name || "",
        description: ld.description || "",
        link: ld.link || config.offer.url,
      },
    });
  }
  // Rank by cost per conversion, not raw count — on a lead funnel a cheap ad
  // with 6 leads on $56 is a better thing to vary than a dear one with 14 on $333.
  return out.sort((a, b) => (a.costPerConversion ?? 1e9) - (b.costPerConversion ?? 1e9));
}

/** Which of the loop's own past variants converted best, per PostHog. */
export async function learnFromPostHog() {
  const health = await instrumentationHealth();
  if (!health.rankingSignal) return { health, ranked: [], winners: [], losers: [] };
  const ranked = await rankAdsBySignal({ signal: health.rankingSignal, days: 21 });
  return {
    health,
    ranked,
    winners: ranked.slice(0, 3),
    losers: ranked.filter((r) => r.converters === 0 && r.sessions >= 25),
  };
}

const SYSTEM = `You write direct-response ad copy in Alex Hormozi's style.
- Lead with a specific, almost-unbelievable-but-true outcome. Concrete numbers over adjectives.
- Name the exact pain, then the dream state, then remove the risk with a real guarantee.
- No hype words, no emoji, no hashtags, no em dashes.
- Short, punchy, spoken-aloud cadence. Every line earns the next.
You are writing a VARIANT of a control ad that is already converting. Change ONE
lever per variant so the test is readable. Never restate a losing angle.`;

// Everything the copywriter is allowed to claim about the agency, and the two
// things it must never say. This is not style guidance — the MRR guarantee is a
// signed contractual term and misstating it is both a misrepresentation of the
// agreement and an income claim, which is a Meta policy violation on top.
const AGENCY_FACTS = `THE OFFER
Varritech is an NYC engineering team that ships production software for founders
using Claude and AI agents. Not a proposal, not a deck: a working build.
The ad's only job is to get a founder onto varritech.com/prepare.

/prepare shows them, with no sales call first: the Scalewright Method
(MAP, BLUEPRINT, BUILD, EQUIP), two reels of real past work (Series A enterprise
and solo-founder MVP), and the full price ladder in the open:
  Enterprise Tune-Up $999 · MVP Development from $99/mo ·
  Scalewright Installation $15,000 (3 per quarter, by application) ·
  Scalewright Managed $8-12K/mo
Discovery calls are gated behind that page and there is one reschedule per founder.
That scarcity is real, so it may be stated plainly.

GUARANTEES YOU MAY CITE
Triple guarantee, unconditional: on time or we work free; production-grade or we
rebuild free; they ship their next feature solo by day 45 or training continues free.

⛔ THE MRR GUARANTEE — EXACT WORDING, NO PARAPHRASE
Say it ONLY as: "if you're not at $10,000 MRR six months after launch, we keep
working free until you are."
NEVER write "we guarantee $10K MRR", "guaranteed $10K MRR", or any promise of an
income figure — the promise is continued work, not the outcome.
NEVER call the remedy a refund or "money back". There is no refund under it.

⛔ Do not invent client names, logos, revenue figures, or headcounts.`;

const VARIANT_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "short kebab slug, e.g. speed-claim" },
          lever: {
            type: "string",
            enum: ["hook", "price-frame", "proof", "guarantee", "pain"],
            description: "the ONE thing this variant changes vs the control",
          },
          family: {
            type: "string",
            enum: ["agency"],
            description: "creative template to render this variant into",
          },
          onImage: {
            type: "object",
            description: "text that goes ON the creative",
            properties: {
              big: { type: "string", description: "the huge number/word, <=7 chars e.g. 45 or $999" },
              bigWord: { type: "string", description: "what that number is, <=18 chars e.g. days to ship" },
              sub: { type: "string", description: "one supporting sentence, <=90 chars" },
              hook: { type: "string", description: "bottom hook line, <=64 chars" },
              cta: { type: "string", description: "2-3 words" },
              badge: { type: "string", description: "short proof/price badge, <=22 chars" },
            },
            required: ["big", "bigWord", "sub", "hook", "cta", "badge"],
          },
          meta: {
            type: "object",
            properties: {
              primaryText: { type: "string", description: "3-5 short lines, blank line between" },
              headline: { type: "string", description: "<=40 chars" },
              description: { type: "string", description: "<=30 chars" },
            },
            required: ["primaryText", "headline", "description"],
          },
        },
        required: ["key", "lever", "family", "onImage", "meta"],
      },
    },
  },
  required: ["variants"],
};

export async function writeVariantCopy({ control, n, learning, alreadyShipped }) {
  const rankNote = learning.health.rankingSignal
    ? `Ranking signal in use: ${learning.health.rankingSignal}. ${learning.health.note}
Best performing of our past variants (ad id, converters/sessions):
${learning.winners.map((w) => `  ${w.adId}: ${w.converters}/${w.sessions} (${(w.rate * 100).toFixed(1)}%)`).join("\n") || "  none yet"}
Proven non-converters, do NOT repeat these angles:
${learning.losers.map((l) => `  ${l.adId}: 0/${l.sessions}`).join("\n") || "  none yet"}`
    : "No conversion signal available yet; write for breadth of angle, not refinement.";

  return askJSON(
    `${AGENCY_FACTS}

Landing page for every variant: ${control.link}

CONTROL AD (this one is actually converting — do not throw it away, vary it):
  primary: ${control.message}
  headline: ${control.headline}
  description: ${control.description}

${rankNote}

Angles already shipped by this loop (do not repeat): ${alreadyShipped.join(", ") || "none"}

Write ${n} variants. Each changes exactly ONE lever versus the control and keeps
everything else recognisably the same ad. The call to action is always to go to
/prepare and book a call — never a purchase, never a download. Every claim must
come from THE OFFER and GUARANTEES above, verbatim where the wording is fixed.`,
    VARIANT_SCHEMA,
    { system: SYSTEM, maxTokens: 4000 },
  );
}

// --------------------------------------------------------------- rendering

const TPL_DIR = path.join(process.cwd(), "template", "statics");

function fill(tpl, tokens) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (tokens[k] ?? ""));
}

function tokensFor(family, v) {
  const oi = v.onImage;

  // The agency creative. The Skills templates below sell a price; this one sells
  // a booked call, so the struck-through price row is replaced by the outcome and
  // the timebox, and the CTA is always /prepare.
  //
  // ⛔ The MRR guarantee is NEVER rendered on the creative. Its correct wording is
  // two clauses long and does not survive being squeezed into a badge, and the
  // truncated version ("$10K MRR guaranteed") is exactly the misstatement that is
  // both an income claim and a misrepresentation of the signed agreement. The
  // unconditional triple guarantee is short enough to render honestly, so that is
  // what goes on the image.
  if (family === "agency") {
    const rows = [
      "A production build, not a proposal or a deck",
      "The Scalewright Method: MAP, BLUEPRINT, BUILD, EQUIP",
      "Shipped with Claude and AI agents, by an NYC team",
      "You ship your next feature solo by day 45",
    ]
      .map((l) => `<div class="hz-row"><span><span class="ck">&#10003;</span>${l}</span></div>`)
      .join("\n      ");
    const stats = [
      ["On time", "or we work free"],
      ["Production", "grade or we rebuild"],
      ["Day 45", "you ship solo"],
    ]
      .map(([a, b]) => `<div><div class="v">${a}</div><div class="l">${b}</div></div>`)
      .join("");
    const steps = [
      ["MAP", "week 1"],
      ["BLUEPRINT", "week 2"],
      ["BUILD", "weeks 3-6"],
      ["EQUIP", "by day 45"],
    ]
      .map(([k, d], i) => `<div class="s${i === 0 ? " on" : ""}"><div class="k">${k}</div><div class="d">${d}</div></div>`)
      .join('<span class="ar">&rarr;</span>');
    return {
      STEPS: steps,
      PILL: "NYC · Series A teams",
      EYEBROW: "Varritech&nbsp;&nbsp;/&nbsp;&nbsp;varritech.com/prepare",
      H1: oi.hook,
      SUB: oi.sub,
      ROWS: rows,
      BIG: oi.big,
      BIG_WORD: oi.bigWord,
      URGENCY: oi.badge,
      STATS: stats,
      CTA: oi.cta.toUpperCase(),
      CHIP: "Triple guarantee",
      FOOT: "See the work, the method and every price before you book",
    };
  }

  if (family === "hormozi") {
    const rows = [
      ["213 production-tested Claude Code skills", "$980"],
      ["OpenClaw autonomous agent, included", "$240"],
      ["15 video + ad render skills", "$180"],
      ["48 growth + outbound workflows", "$146"],
      ["Lifetime updates, every future skill", "$70"],
    ]
      .map(([l, p]) => `<div class="hz-row"><span><span class="ck">&#10003;</span>${l}</span><span class="pr">${p}</span></div>`)
      .join("\n      ");
    // The model's chosen headline number (e.g. "22¢ / per skill" for a price-frame
    // variant) is the whole point of the variant — give it the first stat cell so
    // the angle is actually visible on the creative, not just in the copy.
    const stats = [
      [oi.big, oi.bigWord],
      ["48h", "fix-or-refund"],
      ["14d", "money back"],
    ]
      .map(([a, b]) => `<div><div class="v">${a}</div><div class="l">${b}</div></div>`)
      .join("");
    return {
      EXTRA_CSS: "",
      PILL: "NYC Series A team",
      EYEBROW: "Claude Code Skills Library&nbsp;&nbsp;/&nbsp;&nbsp;v2.0",
      H1: oi.hook,
      SUB: oi.sub,
      ROWS: rows,
      TOTAL: "$1,616",
      WAS: "$1,616",
      NOW: "$47",
      URGENCY: oi.badge,
      STATS: stats,
      CTA: oi.cta.toUpperCase(),
      CHIP: "14-day refund",
      FOOT: "100% money-back if it doesn't 10x your shipping speed",
    };
  }
  if (family === "v3") {
    const feats = [
      ["", "Battle-Tested", "Skills used in real production work"],
      ["p", "Instant Install", "One command, every skill ready"],
      ["d", "Agency-Grade", "Built by Varritech for clients"],
      ["r", "Free Forever", "MIT licensed, no lock-in"],
    ]
      .map(
        ([c, n, d]) =>
          `<div><span class="ic ${c}"><b></b></span><span><span class="nm">${n}</span><span class="ds">${d}</span></span></div>`,
      )
      .join("");
    const chips = ["Remotion", "Figma", "Claude API", "TDD", "Frontend", "Research", "Modern CSS", "Browser"]
      .map((c) => `<span>${c}</span>`)
      .join("");
    const [b, ...rest] = oi.badge.split(" ");
    return {
      BADGE_B: b,
      BADGE_S: rest.join(" ") || "verified",
      BIG_N: oi.big,
      BIG_W: oi.bigWord,
      SUB: oi.sub,
      FEATS: feats,
      CARD_TAG: `${oi.big} skills`,
      CHIPS: chips,
      HOOK: oi.hook,
      CTA: oi.cta.toUpperCase(),
      FOOT_RIGHT: "One time &middot; yours to keep",
    };
  }
  // v2ship
  const grid = [
    ["Marketing", "45+"],
    ["Content", "38+"],
    ["Business", "42+"],
    ["Productivity", "25+"],
    ["Research", "30+"],
    ["Sales", "20+"],
    ["Automation", "22+"],
    ["Strategy", "18+"],
  ]
    .map(
      ([n, c]) =>
        `<a><span class="fo"></span><span class="nm">${n}</span><span class="ct">${c} skills</span></a>`,
    )
    .join("");
  return {
    TOP_RIGHT: `<span class="price"><b>${oi.badge.split(" ")[0]}</b><span>${oi.badge.split(" ").slice(1).join(" ") || "one time"}</span></span>`,
    MOCK_FOOT: `${oi.big} organized skills<br>to build, grow &amp; scale`,
    BIG_N: oi.big,
    BIG_W: oi.bigWord,
    SUB: oi.sub,
    CHIP1: "Organized<br>library",
    CHIP2: "Instant<br>access",
    CHIP3: "Premium<br>quality",
    CHIP4: "Lifetime<br>value",
    GRID: grid,
    HOOK: oi.hook,
    CTA: oi.cta,
    FOOT_RIGHT: "One time &middot; yours to keep",
  };
}

// ⛔ Render over http://127.0.0.1, never file://.
// A file:// page renders PURE WHITE here: the linked stylesheet and the Google
// Fonts request never resolve under the headless shell's file-origin rules, and
// --virtual-time-budget then fires the screenshot on an unstyled page. It fails
// silently — a valid 2160x2700 PNG of nothing, which reads as a working render
// until you check the pixels. Serving the same directory over loopback fixes it.
function serveDir(dir) {
  return new Promise((resolve) => {
    const types = { ".html": "text/html", ".css": "text/css", ".png": "image/png" };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/** Render one variant to a 2160x2700 PNG. Returns the file path. */
export async function renderVariant(v, outDir) {
  const tpl = fs.readFileSync(path.join(TPL_DIR, `${v.family}.html`), "utf8");
  const html = fill(tpl, tokensFor(v.family, v));

  // Render in a copy of the template dir so theme.css + the logo resolve relatively.
  const work = path.join(outDir, v.key);
  fs.mkdirSync(path.join(work, "assets"), { recursive: true });
  fs.copyFileSync(path.join(TPL_DIR, "theme.css"), path.join(work, "theme.css"));
  fs.copyFileSync(
    path.join(TPL_DIR, "assets", "varritech-logo-white-horizontal.png"),
    path.join(work, "assets", "varritech-logo-white-horizontal.png"),
  );
  const page = path.join(work, "ad.html");
  fs.writeFileSync(page, html);

  const png = path.join(outDir, `${v.key}.png`);
  const { server, port } = await serveDir(work);
  try {
    // 1080x1350 at 2x = 2160x2700, matching every control creative on the account
    // exactly, so Meta renders variant and control at identical quality.
    await sh(
      process.env.CHROMIUM_BIN || "chromium",
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        "--window-size=1080,1350",
        "--virtual-time-budget=14000",
        `--user-data-dir=${path.join(work, ".chrome")}`,
        `--screenshot=${png}`,
        `http://127.0.0.1:${port}/ad.html`,
      ],
      { capture: true },
    );
  } finally {
    server.close();
  }
  if (!fs.existsSync(png)) throw new Error(`render produced no file for ${v.key}`);
  assertNotBlank(png, v.key);
  return png;
}

// A blank render is the failure mode this pipeline actually produces, and it is
// invisible downstream: Meta accepts a solid-colour PNG happily and the ad just
// serves nothing. Refuse to ship one.
function assertNotBlank(png, key) {
  const bytes = fs.statSync(png).size;
  if (bytes < 120_000) {
    throw new Error(
      `render for ${key} is ${bytes} bytes — almost certainly a blank/unstyled page (a real variant is 500KB+)`,
    );
  }
}

// --------------------------------------------------------------- retire

/**
 * Pause the loop's own variants that have had a fair shot and produced nothing.
 * Runs BEFORE new ads are added, so the live variant count stays flat instead of
 * growing every day.
 */
export async function retireLosers() {
  const rows = await adInsights({ datePreset: "last_14d" });
  const retired = [];
  for (const r of rows) {
    if (!String(r.ad_name).startsWith(OWNED_PREFIX)) continue; // safety rail
    const { conversions } = conversionsOf(r);
    if (conversions > 0) continue;
    if ((+r.spend || 0) < RETIRE_SPEND_USD) continue;
    const ad = await getObject(r.ad_id, "name,status,effective_status");
    if (ad.status !== "ACTIVE") continue;
    await setAdStatus(r.ad_id, "PAUSED");
    retired.push({ adId: r.ad_id, name: r.ad_name, spend: +r.spend });
  }
  return retired;
}

async function liveVariantCount(adsetId) {
  const data = await getObject(adsetId, "ads.limit(200){name,status}");
  const ads = data.ads?.data || [];
  return ads.filter((a) => a.status === "ACTIVE" && String(a.name).startsWith(OWNED_PREFIX)).length;
}

// --------------------------------------------------------------- the run

export async function runVariantCycle({ batchId, dryRun = false } = {}) {
  const outDir = path.join(os.tmpdir(), `variants-${batchId}`);
  fs.mkdirSync(outDir, { recursive: true });

  const retired = dryRun ? [] : await retireLosers();
  const [proven, learning] = await Promise.all([findProvenStatics(), learnFromPostHog()]);

  if (!proven.length) {
    // Not an error, and not something to route around by inventing an ad set.
    // As of 2026-08-21 every varritech.com agency campaign on this account is
    // PAUSED, so this is the expected state until a human turns one on or names
    // one via VARIANTS_TARGET_ADSET_ID.
    return {
      batchId,
      retired,
      learning,
      shipped: [],
      note:
        `no ${config.offer.goal}-proven static sits in a LIVE ad set. ` +
        `The loop will not create one: standing up an ad set is a spend decision. ` +
        `Activate an agency ad set, or set VARIANTS_TARGET_ADSET_ID to name the live one.`,
    };
  }

  // One source ad set per cycle, rotated by day so every earner gets refreshed
  // rather than the top one hogging the loop forever.
  const byAdset = new Map();
  for (const p of proven) if (!byAdset.has(p.adsetId)) byAdset.set(p.adsetId, p);
  const targets = [...byAdset.values()];

  const shipped = [];
  const alreadyShipped = [];

  for (const target of targets) {
    const liveNow = await liveVariantCount(target.adsetId);
    const room = Math.max(0, Math.min(MAX_NEW_PER_ADSET, MAX_LIVE_VARIANTS - liveNow));
    if (room === 0) {
      shipped.push({ adsetId: target.adsetId, skipped: `at variant cap (${liveNow}/${MAX_LIVE_VARIANTS})` });
      continue;
    }

    const { variants } = await writeVariantCopy({
      control: target.control,
      n: room,
      learning,
      alreadyShipped,
    });

    for (const v of variants.slice(0, room)) {
      const key = `${batchId}-${v.key}`.slice(0, 40);
      alreadyShipped.push(v.key);
      if (dryRun) {
        shipped.push({ key, adsetId: target.adsetId, dryRun: true, lever: v.lever, meta: v.meta });
        continue;
      }
      try {
        const png = await renderVariant({ ...v, key }, outDir);
        const imageHash = await uploadImageBytes(fs.readFileSync(png));
        const name = `${OWNED_PREFIX} ${batchId} | ${v.family} | ${v.lever} | ${v.key}`;
        const creativeId = await createImageCreative({
          name: `Creative | ${name}`,
          imageHash,
          primaryText: v.meta.primaryText,
          headline: v.meta.headline,
          description: v.meta.description,
          link: target.control.link,
          // utm_content = ad id is the account's existing convention and the join key
          // PostHog attribution uses; utm_term carries the human-readable lever.
          urlTags: `utm_source=facebook&utm_medium=paid&utm_campaign=autovariants&utm_content={{ad.id}}&utm_term=${v.lever}-${v.key}`,
        });
        const adId = await createAd({
          name,
          adsetId: target.adsetId,
          creativeId,
          status: config.autonomy === "auto" ? "ACTIVE" : "PAUSED",
        });
        shipped.push({
          key,
          adId,
          creativeId,
          imageHash,
          adsetId: target.adsetId,
          adsetName: target.adsetName,
          sourceAd: target.adName,
          family: v.family,
          lever: v.lever,
          meta: v.meta,
          status: config.autonomy === "auto" ? "ACTIVE" : "PAUSED",
        });
      } catch (err) {
        shipped.push({ key, adsetId: target.adsetId, error: String(err.message || err) });
      }
    }
  }

  return { batchId, retired, learning, shipped };
}
