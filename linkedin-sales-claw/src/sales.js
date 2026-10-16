// The sales conversation, once someone writes back.
//
// The model drafts; CODE decides what is allowed out. Rules enforced here and
// never trusted to the prompt, because prompt rules drift:
//   1. No link but varritech.com. Calls are booked on Cristiano's calendar
//      (src/calendar.js), so no calendar link ever goes out.
//   2. No price. Nobody has set one beyond "free build, pay only if it worked",
//      so any figure the model writes is invented -> hand to Cristiano instead.
//   3. A booking only goes ahead for a qualified lead, on a slot we offered,
//      with an email address THEY typed in the thread.
//   4. Nothing unparseable or half-written ever goes out -> hold, retry next run.

export const REPLY_MAX_WORDS = 90;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|io|co|net|org|ai|app)\b(?:\/\S*)?/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const ALLOWED_HOSTS = ['varritech.com'];
const PLACEHOLDER_RE = /\[[^\]]{2,40}\]|\{[^}]{2,40}\}|<[a-z][^>]{1,40}>/i;
const PRICE_RE = /[$€£]\s?\d|\b\d[\d,.]*\s?(?:k|usd|dollars|per month|\/mo|a month)\b/i;

// Cristiano 2026-10-16: "if they buy the full business bundle, on average, it
// does 80%, and each claw alone can replace an agency."
export const OFFER = [
  'Varritech builds done-for-you AI agents ("claws"). Each claw runs one job end to end inside the business: lead follow-up, outbound, scheduling, quoting, ads, support, reporting, admin.',
  'Each claw on its own can replace an agency. The full business bundle (claws across the whole business) on average takes over 80% of day-to-day operations.',
  'Promo: for qualified businesses we build the first claw FREE, and they only pay us if they feel it actually automated work or added revenue.',
  'The process: 1) a 30 minute call to map where the team\'s hours go, 2) we pick the process with the biggest payoff, 3) we build that claw for free and run it inside their business, 4) they decide afterwards whether it was worth paying for.',
].join(' ');

export const QUALIFIER = 'Qualified = they own the business or make the buying decision, the business is already running with revenue, AND they have a team or clearly repetitive manual work an agent could take over.';

// Real work, described by industry and size only: client names stay private
// (Cristiano 2026-10-03). Figures are the ones in our case-study deck, nothing invented.
export const PROOF = [
  'A 25-year marketing agency, 30 staff, around 200 retail clients: we built an AI agency inside the agency, up to 10 claws (ads, SEO and AI search, landing pages, onboarding, support, reporting) on one screen, every output checked against each client\'s brand kit.',
  'A marketing agency that only did inbound: we built its whole outbound engine, 10 claws reaching prospects on four channels (300 emails, 100 Instagram DMs, 100 texts and 100 AI voice calls a day) with every reply routed to one inbox.',
  'A global trading brokerage: an AI audit of how its team recruits partners, then properly warmed, disclosed outreach accounts per rep with every conversation tracked.',
  'Our own product, Skillsmith: 300+ ready-made AI skills that dozens of agencies run for their outbound.',
  'Enterprise engineering led by our founder: the platform for one of New York\'s best-known landmarks, 1.2M users and 38M tracked events in 90 days.',
  'Our own agency runs on our claws: this LinkedIn outreach, Instagram outreach, ad production and client reporting all run on claws we built.',
  'We have a case-study deck of this work that Cristiano walks through on the call. Offer it as a reason to get on the call; never send a link to it.',
].map((x) => `- ${x}`).join('\n');

// Same closer rubric as the Instagram claw (sales-trainer: SPIN discovery,
// Voss labeling, question-first objections, assumptive two-slot ask), for LinkedIn DMs.
export const SELLING_FRAMEWORK = [
  'HOW YOU SELL IN A DM. One step per message, in this order:',
  '1. Answer what they actually said first, in one or two sentences.',
  '2. Discovery before any pitch. ONE question per message: what they run, team size, where the team\'s week goes, what is done by hand today.',
  '3. Cost of the problem: ask what it costs them if it stays like this, or when they grow. Let them name the cost themselves; never tell them to answer \"in their own words\".',
  '4. Label it back ("sounds like quoting is the bottleneck"), then give ONE proof from the case studies that matches their pain, in a sentence.',
  '5. Every objection gets a question first: price -> "compared to what you spend on it now?", "send me info" -> "what would you need to see to say yes?", "not now" -> "what would need to change?", "we tried AI" -> "what broke?".',
  '6. Once they are qualified and have named a pain, push for the call: offer TWO of the open slots by their exact label, assumptively ("does Mon 10 AM or Tue 2:30 PM ET work better?"). The free first build is the reason to take the call.',
  '7. When they pick a slot, ask for the best email for the invite (if they have not given one). When you have both, book it.',
  'Persuasion levers, used honestly: reciprocity (the free first build), social proof (the case studies), authority (founder, enterprise work), risk reversal (pay only if it worked), commitment (small yeses before the call). Never fake scarcity or urgency.',
].join('\n');

const strip = (text) => text
  .replace(/\s*[—–]\s*/g, ', ')
  .replace(/,\s*,/g, ',')
  .replace(/\s{2,}/g, ' ')
  .trim();

function keepLinks(text) {
  return text.replace(URL_RE, (m) => {
    if (m.includes('@')) return m;
    return ALLOWED_HOSTS.some((h) => m.toLowerCase().includes(h)) ? m : '';
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

export function buildSalesPrompt(lead, { slots = [] } = {}) {
  const thread = (lead.messages ?? [])
    .map((m) => `${m.from === 'us' ? 'Cristiano' : (lead.name || 'Them')}: ${m.text}`)
    .join('\n');
  const open = slots.length
    ? slots.map((s, i) => `S${i + 1} = ${s.label}`).join('\n')
    : '(none right now: do not offer or book a time, keep the conversation going)';
  return [
    'You are Cristiano, founder of Varritech, replying in a LinkedIn DM thread with a business owner you connected with. Your goal is a booked 30 minute call.',
    `What you sell: ${OFFER}`,
    QUALIFIER,
    'Proof you can use (one per message, matched to their pain, never a client name):',
    PROOF,
    '',
    SELLING_FRAMEWORK,
    '',
    'Open call slots on Cristiano\'s calendar (Mon-Fri, 10 AM to 6 PM New York time). Offer only these, by their exact label:',
    open,
    '',
    `Who they are: ${lead.name || 'unknown name'}, headline "${lead.headline || 'unknown'}".`,
    'The thread so far, oldest first:',
    thread,
    '',
    'Write Cristiano\'s NEXT message. Rules:',
    '- Sound like a founder texting, not a brand. Short sentences. Mirror their tone.',
    '- If they are clearly not qualified, be kind, do not push, leave the door open.',
    '- Never state a price, a fee, a percentage of revenue or a timeline promise. If they push on price, say it depends on the build, they pay nothing if it does not work, and you scope it on the call.',
    '- Never send a link of any kind. The call is booked straight onto the calendar.',
    '- If they ask something you cannot answer truthfully from the above, are upset, ask to stop, ask for a human, or want to move a call already booked, set handoff true.',
    `- Under ${REPLY_MAX_WORDS} words. No em dashes. No emoji spam. Never a placeholder like [name].`,
    '',
    'Reply with ONLY a JSON object: {"reply": "<message>", "qualified": true|false|null, "handoff": false, "reason": "<only if handoff>", "book": null}',
    'qualified = true only when they meet ALL of the qualifier, false when they clearly fail it, null when still unknown.',
    'book = {"slot": "S<n>", "email": "<their email>"} ONLY when they have agreed to that exact slot AND written their email in the thread. Otherwise null. When you book, "reply" can be empty: the confirmation is sent for you.',
  ].join('\n');
}

/** Emails they typed themselves, lowercased. */
const theirEmails = (lead) => new Set((lead.messages ?? [])
  .filter((m) => m.from === 'them')
  .flatMap((m) => String(m.text).match(EMAIL_RE) ?? [])
  .map((e) => e.toLowerCase()));

/**
 * -> { action: 'send', text, qualified }
 *  | { action: 'book', start, label, email, qualified }
 *  | { action: 'handoff', reason } | { action: 'hold', reason }
 */
export async function draftReply({ lead, llm, slots = [] }) {
  const out = parseJsonObject(await llm({ prompt: buildSalesPrompt(lead, { slots }) }));
  if (!out || typeof out !== 'object') return { action: 'hold', reason: 'unparseable-draft' };
  if (out.handoff) return { action: 'handoff', reason: String(out.reason || 'model asked for a human') };

  const qualified = out.qualified === true ? true : out.qualified === false ? false : null;
  const want = out.book && typeof out.book === 'object' ? out.book : null;
  if (want && qualified === true) {
    const slot = slots[Number(String(want.slot ?? '').replace(/\D/g, '')) - 1];
    const email = String(want.email ?? '').trim().toLowerCase();
    if (slot && theirEmails(lead).has(email)) return { action: 'book', start: slot.start, label: slot.label, email, qualified };
  }

  if (typeof out.reply !== 'string' || !out.reply.trim()) return { action: 'hold', reason: 'empty-draft' };
  const text = capWords(keepLinks(strip(out.reply)));
  if (!text || PLACEHOLDER_RE.test(text)) return { action: 'hold', reason: 'placeholder-in-draft' };
  if (PRICE_RE.test(text)) return { action: 'handoff', reason: `draft quoted a price: "${text}"` };
  return { action: 'send', text, qualified };
}

/** What goes out once the event exists. Fixed copy: it states facts the code just made true. */
export function bookedText({ label, email }) {
  return `Booked you in for ${label}. The invite with the Google Meet link is on its way to ${email}. Looking forward to it.`;
}
