// STAGE 3a — Build ONE video ad end to end:
//   copy template -> inject adcopy.ts (hook+karaoke+brand+footage names) ->
//   generate Veo3 footage per beat (or code stand-in fallback) -> ElevenLabs VO ->
//   remotion render mobile -> framecheck strip vs source -> upload to GCS.
// Returns { mp4Url, posterUrl, stripUrl, copy }.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { sh } from "../lib/sh.js";
import { veoGenerate } from "../lib/veo.js";
import { uploadPublic } from "../lib/gcs.js";
import { ttsLiam } from "../lib/tts.js";

const TEMPLATE = "/app/template/video"; // baked into the image
const FRAMECHECK = "/app/skills/framecheck.sh";

// Veo prompt seeds per footage slot — casual 20s-30s builder, handheld vlog energy.
const FOOTAGE_PROMPTS = {
  rooftop: "two casual startup founders standing on a city rooftop at golden hour, wide shot, handheld vlog, skyline behind",
  dim: "a young founder alone at a laptop in a dim room at night, screen glow on face, looking at phone, handheld",
  ledge: "a founder talking to camera selfie-style on a rooftop ledge, daytime, city behind, handheld vlog",
  desk: "a founder talking to camera at a home desk with a bookshelf behind, warm light, handheld selfie",
  twoshot: "two founders taking a selfie together outdoors, smiling, rooftop, arm extended, handheld",
};

function writeAdcopy(dir, copy, footageNames) {
  // Build a fresh adcopy.ts from the Hormozi copy + chosen footage filenames.
  const phrasesFrom = (arr) =>
    JSON.stringify(
      (arr || []).map((p, i) => ({ startFrame: i * 45, words: p.words })),
      null,
      2
    );
  const k = copy.karaoke || [];
  // distribute the 4-5 karaoke phrases across scenes 3..6
  const ts =
    `export type KWord = { text: string; highlight: boolean };\n` +
    `export type Phrase = { words: KWord[]; startFrame: number };\n` +
    `export const AD = {\n` +
    `  brand: ${JSON.stringify(config.offer.brand)},\n` +
    `  hookLines: ${JSON.stringify(copy.hookLines)},\n` +
    `  notif: { app: ${JSON.stringify(config.offer.name.split(" ")[0] || "Varritech")}, line: ${JSON.stringify(copy.notifLine || "your people are waiting")} },\n` +
    `  footage: ${JSON.stringify(footageNames)},\n` +
    `  scene3: ${phrasesFrom(k.slice(0, 1))},\n` +
    `  scene4: ${phrasesFrom(k.slice(1, 2))},\n` +
    `  scene5: ${phrasesFrom(k.slice(2, 3))},\n` +
    `  scene6: ${phrasesFrom(k.slice(3, 5))},\n` +
    `  endCard: { brandName: ${JSON.stringify((config.offer.name.split(" ")[0] || "VARRITECH").toUpperCase())}, cta: ${JSON.stringify(copy.endCardCta)}, url: ${JSON.stringify(config.offer.url.replace(/^https?:\/\//, ""))} },\n` +
    `};\n`;
  fs.writeFileSync(path.join(dir, "src", "adcopy.ts"), ts);
}

export async function buildVideo({ batchId, variant, plan, copy }) {
  const dir = path.join(config.workdir, `${batchId}-video-${variant}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // copy template (code only; node_modules installed once in image at /app/template/video)
  await sh("cp", ["-R", `${TEMPLATE}/.`, dir]);

  // footage: generate each Veo clip; on failure leave the bundled stand-in clip in public/
  const footageNames = {
    rooftop: "veo_rooftop_wide.mp4",
    dim: "veo_dim_laptop.mp4",
    ledge: "veo_talking_ledge.mp4",
    desk: "veo_talking_desk.mp4",
    walking: "veo_talking_desk.mp4",
    twoshot: "veo_selfie_twoshot.mp4",
  };
  for (const [slot, prompt] of Object.entries(FOOTAGE_PROMPTS)) {
    const out = path.join(dir, "public", footageNames[slot] || `veo_${slot}.mp4`);
    const got = await veoGenerate({ prompt, outPath: out });
    if (!got) console.warn(`[build-video] Veo skipped for ${slot}; using bundled stand-in`);
  }

  // copy + VO
  writeAdcopy(dir, copy, footageNames);
  await ttsLiam(copy.voScript || copy.meta.primaryText, path.join(dir, "public", "vo.mp3"));

  // install deps once per container is cheaper if template ships node_modules; otherwise npm i
  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    await sh("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir });
  }

  // render mobile (Chromium headless; ANGLE for Cloud Run no-GPU)
  const mp4 = path.join(dir, "out", "mobile.mp4");
  await sh(
    "npx",
    [
      "remotion", "render", "VideoMobile", "out/mobile.mp4",
      "--log=error", "--gl=angle",
      // cap parallel Chromium tabs so render can't OOM the container
      "--concurrency=2",
    ],
    { cwd: dir }
  );

  // poster (frame at 1.2s)
  const poster = path.join(dir, "out", "poster.jpg");
  await sh("ffmpeg", ["-ss", "1.2", "-i", mp4, "-frames:v", "1", "-y", poster, "-loglevel", "error"]);

  // framecheck vs source (if we had a source); else skip strip
  let stripUrl = null;
  if (plan.sourcePath && fs.existsSync(plan.sourcePath)) {
    const strip = path.join(dir, "out", "strip.png");
    await sh("bash", [FRAMECHECK, plan.sourcePath, mp4, strip, "1.5", "4.5", "7.5", "12", "18", "24", "28.5"]);
    stripUrl = await uploadPublic(strip, `${config.gcs.prefix}/${batchId}/video-${variant}-strip.png`, "image/png");
  }

  const mp4Url = await uploadPublic(mp4, `${config.gcs.prefix}/${batchId}/video-${variant}-mobile.mp4`, "video/mp4");
  const posterUrl = await uploadPublic(poster, `${config.gcs.prefix}/${batchId}/video-${variant}-poster.jpg`, "image/jpeg");

  return { kind: "video", variant, mp4Url, posterUrl, stripUrl, copy, angle: plan.angle };
}
