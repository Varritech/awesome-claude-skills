// Opener drafting.
//
// Two constraints are enforced in CODE, never in the prompt, because prompt
// rules drift and these two are load-bearing:
//   1. NO LINKS IN A COLD OPENER. First contact with a stranger stays clean; a
//      link in message one is the spammiest possible opening.
//      ⛔ Follow-ups are different and MAY carry a link. The old blanket ban was
//      inherited from the API claw, where InstantDM rejects any DM containing a
//      URL ([[reference_instantdm_blocks_all_links_in_dms]]). This claw types
//      into the real Instagram web composer, so that limit does not apply. It is
//      an ALLOWLIST though, not a free-for-all — see ALLOWED_LINK_HOSTS.
//   2. SHORT. Long first DMs read as a broadcast and get ignored or reported.
//   3. NO EM DASHES. Cristiano's standing rule on everything that goes out under
//      his name. The model ignores it when it is only in the prompt.

export const OPENER_MAX_WORDS = 35;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|io|co|net|org|ai|app)\b\S*/gi;

/**
 * Cristiano never uses an em dash. It is a standing rule across every channel,
 * and these DMs go out under his name, so it is enforced HERE rather than in the
 * prompt — the live model put one in 3 of 4 first drafts even when told not to.
 * A dash between clauses becomes a comma; anything else becomes a plain space.
 */
export function stripEmDashes(text) {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * The only hosts a drafted message may link to.
 *
 * An allowlist rather than "any URL is fine": a hallucinated, mistyped or
 * model-invented link going out under Cristiano's name is worse than no link.
 */
export const ALLOWED_LINK_HOSTS = [
  'varritech.com',
  'www.varritech.com',
  'varritech-product-playbook.vercel.app',
];

/** Strip every link EXCEPT ones pointing at a host we authorised. */
export function stripLinksExcept(text, hosts = ALLOWED_LINK_HOSTS) {
  return text
    .replace(URL_RE, (m) => (hosts.some((h) => m.toLowerCase().includes(h)) ? m : ''))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function stripLinks(text) {
  return text.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim();
}

// Trim to whole sentences under the word cap — never mid-word, never mid-thought.
export function capWords(text, max = OPENER_MAX_WORDS) {
  if (text.split(/\s+/).filter(Boolean).length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const kept = [];
  let count = 0;
  for (const s of sentences) {
    const n = s.trim().split(/\s+/).filter(Boolean).length;
    if (count + n > max) break;
    kept.push(s.trim());
    count += n;
  }
  return (kept.join(' ') || sentences[0].trim()).trim();
}

/**
 * A slot the model left for itself: "[space/niche]", "{name}", "<topic>".
 * Seen live on the first real drafting run. Sending one verbatim is worse than
 * sending nothing, so an opener carrying one is dropped entirely rather than
 * patched — there is no safe way to guess what belonged there.
 */
const PLACEHOLDER_RE = /\[[^\]]{2,40}\]|\{[^}]{2,40}\}|<[a-z][^>]{1,40}>/i;

export function hasPlaceholder(text) {
  return PLACEHOLDER_RE.test(text);
}

// What we know about this person, in the model's own working language. A
// commenter is the only source that hands us their actual words — which is also
// the only case where the feed can lie to us, because Instagram elides a long
// comment to a prefix and quoting that prefix back reads as a non-sequitur.
function contextFor(target) {
  if (target.source === 'commenter') {
    const quoted = `They commented "${target.commentText}" on our post.`;
    return target.truncated
      ? `${quoted} That comment is CUT OFF — it is only the first part of what they wrote, so do not quote it back to them; react to the gist instead.`
      : quoted;
  }
  if (target.source === 'liker') {
    // ⛔ Without a caption we genuinely do not know which post it was. Left to
    // itself the model fills the gap — it wrote "the post about scaling with
    // automation" on a live draft 2026-08-17, inventing a topic for OUR OWN
    // post. A first DM that misdescribes our content is worse than a plain one.
    return target.caption
      ? `They liked our post about "${target.caption}".`
      : 'They liked one of our posts. You do NOT know which one or what it was about, so do not describe what the post said, and do not guess at its topic.';
  }
  return 'They just followed us.';
}

export function buildPrompt(target) {
  const who = contextFor(target);
  return [
    'You are Cristiano, founder of Varritech, opening a DM on Instagram.',
    who,
    `Write ONE opener under ${OPENER_MAX_WORDS} words.`,
    'Rules: no links, no pitch, no price, no emoji spam. Reference what they engaged with if there is something to reference.',
    'Write the FINAL text. Never leave a placeholder like [niche] or {name} — if you do not know something, do not refer to it.',
    'End on a genuine question about what they are building. Sound like a person, not a brand.',
  ].join(' ');
}

export async function draftOpener({ target, llm }) {
  const raw = await llm({ prompt: buildPrompt(target), target });
  const text = capWords(stripEmDashes(stripLinks(String(raw ?? '').trim())));
  // Drop, don't patch. An empty opener means this person is simply skipped this
  // run and picked up next time — they are not marked contacted.
  return hasPlaceholder(text) ? '' : text;
}

/**
 * Knock one: give them something instead of asking again.
 *
 * FIXED COPY, not an LLM draft, and deliberately so. The price anchor, the
 * programme name and the URL all have to survive verbatim — a model
 * paraphrasing "$149.99" into "around $150", renaming Scalewright, or mangling
 * the link is a far worse outcome than zero personalisation. Cristiano wrote
 * this; it ships as written.
 */
export const GUIDE_URL = process.env.GUIDE_URL || 'https://varritech-product-playbook.vercel.app/guide-1';

const GUIDE_PREAMBLE =
  'Hey, we typically charge $149.99 for this guide. It outlines the strategy phase, ' +
  'the most important part of our Scalewright program, and it is the framework we use ' +
  'to guarantee people $10k in monthly recurring revenue.';

export const FOLLOW_UP_GUIDE_TEXT = `${GUIDE_PREAMBLE} Here it is: ${GUIDE_URL}`;

/**
 * The commenter branch of knock one: the Skills Library, not the guide.
 *
 * FIXED COPY for the same reason the guide text is — the vault size, both
 * prices and the URL have to survive verbatim. Numbers from the 2026-09-11
 * reprice (vds-marketing-core PR #494): 268 skills, Essential $299 for the
 * whole vault / Premium $999 with five custom skills, both one time.
 * ⛔ If the LP changes, change it here too; a claw quoting a retired price is
 * exactly the defect that had the sales claw arguing "the 268 isn't a number we
 * quote" at a prospect who had just read the page.
 */
export const SKILLS_LP_URL =
  process.env.SKILLS_LP_URL || 'https://www.varritech.com/products/claude-skills-library-pro';

const SKILLSMITH_PREAMBLE =
  'Since you commented, this is the thing behind that post. The Claude Skills Library is the ' +
  'skill set that automated my seven-figure agency, 268 of them, and it lets you replace whole ' +
  'departments through prompting instead of hiring them. $299 for the entire vault, or $999 ' +
  'with five custom skills our team builds for you, one time either way.';

/**
 * Knock one, with the link swapped for a reply-ask when Instagram has taken
 * link-sharing away.
 *
 * @varritech picked up a "you can't share links" restriction on 2026-08-28
 * (ends 2026-09-27) — DMs still send fine, only URLs are barred. Sending the
 * normal copy would either be dropped or push a flagged account further, and
 * sending it with the URL simply deleted leaves "Here it is:" pointing at
 * nothing. The price anchor and the programme name are Cristiano's and ship
 * verbatim either way ([[feedback_guide_price_anchor_is_deliberate]]); only the
 * delivery clause changes.
 */
export function followUpGuideText({ linksBlocked = false, source = null } = {}) {
  // A COMMENTER told us what they care about in their own words, which makes
  // them the warmest source we get and the one worth pointing at the product
  // rather than the strategy guide. Cristiano, 2026-09-09: "if it commented it
  // should gear towards selling them the skillssmith."
  //
  // ⛔ The $149.99 anchor and the Scalewright wording below are UNTOUCHED for
  // followers and likers — queried and overridden once already. This is a new
  // branch, not a correction of that one.
  if (source === 'commenter') {
    if (!linksBlocked) return `${SKILLSMITH_PREAMBLE} Here it is: ${SKILLS_LP_URL}`;
    return `${SKILLSMITH_PREAMBLE} I can't send links from this account right now, so just reply here and I'll get it over to you.`;
  }
  if (!linksBlocked) return FOLLOW_UP_GUIDE_TEXT;
  return `${GUIDE_PREAMBLE} I can't send links from this account right now, so just reply here and I'll get it over to you.`;
}

/**
 * Every follow-up past the fixed knock one is a VALUE TOUCHPOINT (src/value.js):
 * one short message carrying one real item (AI news, a guide, the router offer).
 * Cristiano, 2026-10-22: "Always with value, not just wishing you the best with
 * whatever they created." The old "close warmly, leave the door open, ask
 * nothing" prompt was exactly the banned empty check-in and is gone.
 *
 * Reopened old threads take the same route: nothing in the prompt claims a past
 * message or guide, because the item is the whole reason for writing.
 */
import { buildLibrary, draftValueFollowUp, loadNews, priorValueIds } from './value.js';

const VALUE_PATH = process.env.CLAW_VALUE || new URL('../state/value-library.json', import.meta.url).pathname;

/**
 * Draft a follow-up and say which value item it carries.
 * Returns { text, valueId, skipped, reason? }; text '' means "send nothing this run".
 */
export async function draftFollowUpFull({ target, llm, linksBlocked = false, library, entry, log }) {
  // Knock one is Cristiano's fixed guide / Skills copy, verbatim (see above).
  if (target.followUpNumber === 1 && !target.reopen) {
    return {
      text: followUpGuideText({ linksBlocked, source: target.source }),
      valueId: target.source === 'commenter' ? 'skills-library' : 'guide-1',
      skipped: false,
    };
  }
  const lib = library ?? buildLibrary({ news: loadNews(VALUE_PATH), now: new Date() });
  const sentIds = priorValueIds(entry ?? { valueItems: target.valueItems, followUps: target.priorFollowUps }, lib);
  return draftValueFollowUp({ target, library: lib, sentIds, llm, linksBlocked, ...(log ? { log } : {}) });
}

export async function draftFollowUp(args) {
  return (await draftFollowUpFull(args)).text;
}
