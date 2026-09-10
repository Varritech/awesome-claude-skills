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
 * prices and the URL have to survive verbatim. Numbers re-curled from the live
 * LP 2026-09-09: 268 skills, $47 Essential / $197 Premium, both one time.
 * ⛔ If the LP changes, change it here too; a claw quoting a retired price is
 * exactly the defect that had the sales claw arguing "the 268 isn't a number we
 * quote" at a prospect who had just read the page.
 */
export const SKILLS_LP_URL =
  process.env.SKILLS_LP_URL || 'https://www.varritech.com/products/claude-skills-library-pro';

const SKILLSMITH_PREAMBLE =
  'Since you commented, this is the thing behind that post. The Claude Skills Library is the ' +
  'skill set that automated my seven-figure agency, 268 of them, and it lets you replace whole ' +
  'departments through prompting instead of hiring them. $47 to start or $197 for the entire ' +
  'vault, one time either way.';

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
 * Knock two: the last message, and the only one the model writes.
 *
 * No link and nothing to claim — knock one already gave them the thing. This
 * one exists only to close warmly and stop. It is told not to chase, because
 * "just following up" makes the silence the subject and is the fastest route to
 * a report.
 */
export function buildFollowUpPrompt(target) {
  return [
    'You are Cristiano, founder of Varritech, on Instagram.',
    `You messaged @${target.handle} ${target.silentDays} days ago and sent them a free guide. They never replied.`,
    `Your first message was: "${target.opener}"`,
    'Write ONE short message under 30 words. This is your LAST message to them.',
    'Close it warmly, leave the door open, and ask nothing that demands a reply.',
    '⛔ Do not repeat or rephrase what you already sent — say something different.',
    '⛔ Never guilt them, never chase. No "just following up", no "did you see my message", no "bumping this". Their silence is not the subject.',
    'No links, no pitch, no price. Write the FINAL text, never a placeholder like [niche] or {name}.',
  ].join(' ');
}

/**
 * Reopening a thread with someone Cristiano has ALREADY spoken to on Instagram,
 * sometimes a long time ago. 34 of these sat permanently frozen until
 * 2026-09-10.
 *
 * ⛔ This is NOT knock one. There is no opener of ours to follow up on and no
 * guide we sent them, so the standard follow-up prompt would assert something
 * that never happened. And leading months of silence with a price is the wrong
 * first move on someone who already knows him — the pitch comes after they
 * answer, through the normal ladder.
 */
export function buildReopenPrompt(target) {
  return [
    "You are Cristiano, founder of Varritech, on Instagram.",
    `You and @${target.handle} have spoken in this thread before, but it has gone quiet.`,
    "Write ONE short message under 30 words that reopens it warmly.",
    "⛔ Do NOT reference any specific past message, guide or offer — you do not remember the details and inventing one is worse than saying nothing.",
    "⛔ No links, no pitch, no price. Do not sell anything in this message.",
    "Ask a genuine question about what they are building or working on now.",
    "Sound like a person picking a conversation back up, not a brand running a campaign.",
    "Write the FINAL text, never a placeholder like [niche] or {name}.",
  ].join(" ");
}

export async function draftFollowUp({ target, llm, linksBlocked = false }) {
  // An old thread being reopened gets a human re-open, never the fixed pitch.
  if (target.reopen) {
    const raw = await llm({ prompt: buildReopenPrompt(target), target });
    return capWords(stripEmDashes(stripLinks(String(raw ?? "").trim())), 30);
  }

  // Knock one is the fixed value drop. No model involved, no word cap applied —
  // it is already the length it needs to be to carry the anchor and the link.
  if (target.followUpNumber === 1) return followUpGuideText({ linksBlocked, source: target.source });

  const raw = await llm({ prompt: buildFollowUpPrompt(target), target });
  // stripLinksExcept rather than stripLinks: a browser-sent DM carries a URL
  // fine, so an authorised Varritech link may survive if the model adds one.
  const stripped = linksBlocked
    ? stripLinks(String(raw ?? '').trim())
    : stripLinksExcept(String(raw ?? '').trim());
  const text = capWords(stripEmDashes(stripped));
  return hasPlaceholder(text) ? '' : text;
}

