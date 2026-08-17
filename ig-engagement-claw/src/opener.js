// Opener drafting.
//
// Two constraints are enforced in CODE, never in the prompt, because prompt
// rules drift and these two are load-bearing:
//   1. NO LINKS. A cold opener with a link is both the spammiest possible first
//      contact and structurally undeliverable downstream — Meta/InstantDM reject
//      any DM containing a URL. See [[reference_instantdm_blocks_all_links_in_dms]].
//   2. SHORT. Long first DMs read as a broadcast and get ignored or reported.

export const OPENER_MAX_WORDS = 35;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|io|co|net|org|ai|app)\b\S*/gi;

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
    return `They liked our post${target.caption ? ` about "${target.caption}"` : ''}.`;
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
  const text = capWords(stripLinks(String(raw ?? '').trim()));
  // Drop, don't patch. An empty opener means this person is simply skipped this
  // run and picked up next time — they are not marked contacted.
  return hasPlaceholder(text) ? '' : text;
}
