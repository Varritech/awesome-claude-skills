// STAGE 2 — Hormozi hook + full ad copy.
// Produces: the on-screen HOOK (3 short caps lines), per-beat karaoke phrases with
// ONE highlighted keyword each, the end-card CTA, AND the Meta ad copy
// (primary text + headline + description) — all in Hormozi style:
// big specific promise, named pain, proof, urgency, clear CTA. No emoji.
import { askJSON } from "../lib/anthropic.js";
import { config } from "../config.js";

const SYSTEM = `You write direct-response ad copy in Alex Hormozi's style:
- Lead with a specific, almost-unbelievable-but-true outcome.
- Name the exact pain and the dream state.
- Concrete numbers over adjectives. No hype words, no emoji, no hashtags.
- Short, punchy, spoken-aloud cadence. Every line earns the next.`;

export async function writeCopy({ angle, beats, kind }) {
  // kind: 'video' (needs hook + karaoke + endcard + meta copy) | 'static' (needs poster lines + meta copy)
  const isVideo = kind === "video";
  const schema = {
    type: "object",
    properties: {
      hookLines: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
        description: "3 SHORT all-caps hook lines for the opening card",
      },
      karaoke: isVideo
        ? {
            type: "array",
            minItems: 4,
            maxItems: 5,
            description: "one phrase per talking-head beat; 2-4 words; mark ONE keyword",
            items: {
              type: "object",
              properties: {
                words: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      highlight: { type: "boolean" },
                    },
                    required: ["text", "highlight"],
                  },
                },
              },
              required: ["words"],
            },
          }
        : { type: "array", items: {} },
      endCardCta: { type: "string", description: "2-3 word CTA, e.g. GET THE SKILLS" },
      meta: {
        type: "object",
        properties: {
          primaryText: { type: "string", description: "Hormozi primary text, 2-4 short lines" },
          headline: { type: "string", description: "<=40 chars" },
          description: { type: "string", description: "<=30 chars" },
        },
        required: ["primaryText", "headline", "description"],
      },
      staticPoster: {
        type: "object",
        description: "for static ads: big headline + subhead + CTA chip text",
        properties: {
          headline: { type: "string" },
          subhead: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
    required: ["hookLines", "endCardCta", "meta"],
  };

  return askJSON(
    `Offer: ${config.offer.name} — ${config.offer.pitch}
URL: ${config.offer.url}
Creative angle: ${angle}
Ad type: ${kind}
${beats ? `Beats: ${JSON.stringify(beats)}` : ""}
Write the copy. ALL on-screen text in caps where noted. Keyword highlights should land on the word that carries the promise.`,
    schema,
    { system: SYSTEM, maxTokens: 1800 }
  );
}
