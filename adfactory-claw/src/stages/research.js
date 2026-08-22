// STAGE 1 — Video research.
// Picks the day's replication source. Two modes:
//  (a) MINING_SOURCE_GLOB set -> use a pre-mined local swipe file (fast, deterministic)
//  (b) otherwise -> ask Claude for the day's strongest build-in-public / skills-niche
//      reel ANGLE + a fresh storyboard skeleton so the build never repeats verbatim.
// The actual viral scrape (Apify) is the heavy `viral-content-mining` skill; for an
// unattended daily claw we keep a rotating local swipe pool and let Claude choose +
// re-angle, logging which source it used.
import fs from "node:fs";
import path from "node:path";
import { askJSON } from "../lib/anthropic.js";
import { config } from "../config.js";

const SWIPE_DIR = process.env.SWIPE_DIR || "/app/swipe"; // mounted pool of source .mp4s

function listSwipes() {
  try {
    return fs
      .readdirSync(SWIPE_DIR)
      .filter((f) => /\.(mp4|mov)$/i.test(f))
      .map((f) => path.join(SWIPE_DIR, f));
  } catch {
    return [];
  }
}

// Returns { sourcePath|null, angle, beats[], notes } for the day.
export async function research({ dayIndex, variant }) {
  const swipes = listSwipes();
  // rotate through the pool deterministically; offset by variant so 2 videos differ
  const sourcePath =
    swipes.length > 0 ? swipes[(dayIndex + variant) % swipes.length] : null;

  const plan = await askJSON(
    `You are picking the angle for a short vertical ad for "${config.offer.name}".
Offer: ${config.offer.pitch}
URL: ${config.offer.url}
This is variant ${variant + 1} of ${config.counts.video} for today (make it DISTINCT from a generic take).
${sourcePath ? `It will frame-match this viral source reel: ${path.basename(sourcePath)} (build-in-public energy).` : "No source reel; build a native build-in-public reel from scratch."}
Return a 7-beat storyboard skeleton in the proven structure:
hook card (1) -> notification beat (1) -> talking-head karaoke beats (4) -> end card (1).`,
    {
      type: "object",
      properties: {
        angle: { type: "string", description: "one-line creative angle for this variant" },
        beats: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["hook", "notif", "talking", "endcard"] },
              shot: { type: "string", description: "footage framing to generate (Veo prompt seed)" },
              note: { type: "string" },
            },
            required: ["kind", "shot"],
          },
        },
        notes: { type: "string" },
      },
      required: ["angle", "beats"],
    },
    { maxTokens: 1500 }
  );

  return { sourcePath, ...plan };
}
