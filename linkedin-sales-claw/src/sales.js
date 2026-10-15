// The sales conversation, once someone writes back.
//
// The model drafts; CODE decides what is allowed out. Three rules are enforced
// here and never trusted to the prompt, because prompt rules drift:
//   1. No link but ours, and the calendar link only once the lead is qualified.
//   2. No price. Nobody has set one beyond "free build, pay only if it worked",
//      so any figure the model writes is invented -> hand to Cristiano instead.
//   3. Nothing unparseable or half-written ever goes out -> hold, retry next run.

import { CALENDLY_URL } from './copy.js';

export const REPLY_MAX_WORDS = 90;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|io|co|net|org|ai|app)\b\S*/gi;
const ALLOWED_HOSTS = ['calendly.com/christian-varritech', 'varritech.com'];
const PLACEHOLDER_RE = /\[[^\]]{2,40}\]|\{[^}]{2,40}\}|<[a-z][^>]{1,40}>/i;
const PRICE_RE = /[$€£]\s?\d|\b\d[\d,.]*\s?(?:k|usd|dollars|per month|\/mo|a month)\b/i;

export const OFFER = [
  'Varritech builds done-for-you AI agents that take over up to 80% of a company\'s day-to-day operations (lead follow-up, scheduling, quoting, admin, support, reporting, whatever eats the team\'s hours).',
  'Promo: for qualified businesses we build the first agent FREE, and they only pay us if they feel it actually automated work or added revenue to the company.',
  'The process: 1) a 30 minute call to map where the team\'s hours go, 2) we pick the process with the biggest payoff, 3) we build the agent for free and run it inside their business, 4) they decide afterwards whether it was worth paying for.',
].join(' ');

export const QUALIFIER = 'Qualified = they own the business or make the buying decision, the business is already running with revenue, AND they have a team or clearly repetitive manual work an agent could take over.';

const strip = (text) => text
  .replace(/\s*[—–]\s*/g, ', ')
  .replace(/,\s*,/g, ',')
  .replace(/\s{2,}/g, ' ')
  .trim();

function keepLinks(text, { qualified }) {
  return text.replace(URL_RE, (m) => {
    const lower = m.toLowerCase();
    if (!ALLOWED_HOSTS.some((h) => lower.includes(h))) return '';
    if (lower.includes('calendly') && qualified !== true) return '';
    return m;
  }).replace(/\s+([.,!?])/g, '$1').replace(/[:\s]+$/, (s) => (s.includes(':') ? '.' : '')).replace(/\s{2,}/g, ' ').trim();
}

function capWords(text, max = REPLY_MAX_WORDS) {
  if (text.split(/\s+/).length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const kept = [];
  let n = 0;
  for (const s of sentences) {
    const w = s.trim().split(/\s+/).length;
    if (n + w > max) break;
    kept.push(s.trim());
    n += w;
  }
  return kept.join(' ') || sentences[0].trim();
}

function parseJsonObject(raw) {
  const s = String(raw ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

export function buildSalesPrompt(lead) {
  const thread = (lead.messages ?? [])
    .map((m) => `${m.from === 'us' ? 'Cristiano' : (lead.name || 'Them')}: ${m.text}`)
    .join('\n');
  return [
    'You are Cristiano, founder of Varritech, replying in a LinkedIn DM thread with a business owner you connected with.',
    `What you sell: ${OFFER}`,
    QUALIFIER,
    `Who they are: ${lead.name || 'unknown name'}, headline "${lead.headline || 'unknown'}".`,
    'The thread so far, oldest first:',
    thread,
    '',
    'Write Cristiano\'s NEXT message. How to sell:',
    '- Answer what they actually said first. Sound like a founder texting, not a brand. Short sentences.',
    '- Ask ONE question at a time. Find out what is unqualified-unknown: do they own/decide, is the business running, team size or the manual work that eats their hours.',
    '- When they show interest or ask how it works, explain the 4-step process plainly and the free build + pay-only-if-it-worked promo.',
    `- Only once they are qualified AND interested, invite them to book: ${CALENDLY_URL}`,
    '- If they are clearly not qualified, be kind, do not push, leave the door open.',
    '- Never state a price, a fee, a percentage of revenue or a timeline promise. If they push on price, say it depends on the build and that they pay nothing if it does not work, and that you scope it on the call.',
    '- If they ask something you cannot answer truthfully from the above, are upset, ask to stop, or ask for a human, set handoff true.',
    `- Under ${REPLY_MAX_WORDS} words. No em dashes. No emoji spam. Never a placeholder like [name].`,
    '',
    'Reply with ONLY a JSON object: {"reply": "<message>", "qualified": true|false|null, "handoff": false, "reason": "<only if handoff>"}',
    'qualified = true only when they meet ALL of the qualifier, false when they clearly fail it, null when still unknown.',
  ].join('\n');
}

/**
 * -> { action: 'send', text, qualified } | { action: 'handoff', reason } | { action: 'hold', reason }
 */
export async function draftReply({ lead, llm }) {
  const out = parseJsonObject(await llm({ prompt: buildSalesPrompt(lead) }));
  if (!out || typeof out !== 'object') return { action: 'hold', reason: 'unparseable-draft' };
  if (out.handoff) return { action: 'handoff', reason: String(out.reason || 'model asked for a human') };
  if (typeof out.reply !== 'string' || !out.reply.trim()) return { action: 'hold', reason: 'empty-draft' };

  const qualified = out.qualified === true ? true : out.qualified === false ? false : null;
  const text = capWords(keepLinks(strip(out.reply), { qualified }));
  if (!text || PLACEHOLDER_RE.test(text)) return { action: 'hold', reason: 'placeholder-in-draft' };
  if (PRICE_RE.test(text)) return { action: 'handoff', reason: `draft quoted a price: "${text}"` };
  return { action: 'send', text, qualified };
}
