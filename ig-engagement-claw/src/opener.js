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

export function buildPrompt(target) {
  const who =
    target.source === 'liker'
      ? `They liked our post${target.caption ? ` about "${target.caption}"` : ''}.`
      : `They just followed us.`;
  return [
    'You are Cristiano, founder of Varritech, opening a DM on Instagram.',
    who,
    `Write ONE opener under ${OPENER_MAX_WORDS} words.`,
    'Rules: no links, no pitch, no price, no emoji spam. Reference what they engaged with if there is something to reference.',
    'End on a genuine question about what they are building. Sound like a person, not a brand.',
  ].join(' ');
}

export async function draftOpener({ target, llm }) {
  const raw = await llm({ prompt: buildPrompt(target), target });
  return capWords(stripLinks(String(raw ?? '').trim()));
}
