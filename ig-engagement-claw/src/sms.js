/**
 * The SMS concierge: the second half of the free-pack funnel.
 *
 * Someone typed their phone number into the Skills landing page to get the
 * free 5-skill pack. The pack goes out by email. This is what happens next —
 * Cristiano texts them from the Quo line, asks what they are building, and
 * answers whatever they ask about the skills.
 *
 * ⛔ THE CONSENT IS EXACTLY AS WIDE AS IT SOUNDS. They asked for a download and
 * agreed to be texted about it. That is not permission to blast a list. Every
 * rule below exists because the cost of getting this wrong is a carrier
 * complaint against the number the whole business texts from:
 *   - nobody enters a batch who is not on a real capture row with a real number
 *   - one first touch per number, ever
 *   - STOP is absolute and immediate, and it is checked before anything else
 *   - a send window well inside the legal 8am-9pm
 *   - hard per-run, per-hour and per-day caps
 *   - a kill switch, and SMS_ENABLED off by default at the CLI
 *
 * Node owns every one of those decisions. The model owns exactly one thing:
 * the words of a reply to a question they asked us first. It never decides who
 * gets a text, and every draft it writes goes through the guards in
 * `draftReply` before it can leave.
 */

import { isSendingWindow } from './select.js';
import { offerBriefing, workforceBriefing, SMS_KNOWN_PRICES, VOICE, quotesOnlyKnownPrices, misattributesVaultPrice } from './offers.js';

const HOUR = 3600_000;
const DAY = 86400_000;

/**
 * Same permissive E.164 rule the landing page validates against. Kept as its
 * own copy on purpose: the two systems are in different repos and a shared
 * "utility" across that boundary would just be a stale import.
 */
export const isPlausiblePhone = (p) => /^\+[1-9][0-9]{7,14}$/.test(String(p ?? ''));

/**
 * Quiet hours, deliberately narrower than the law.
 *
 * TCPA allows 8am to 9pm in the recipient's local time. We only know their
 * number, not where they are, so the window is run in America/New_York and
 * pulled in at both ends: a 9am ET start is 6am on the west coast, which is
 * still early, and 20 stops well before anyone's evening is over. Losing an
 * hour of send volume is cheaper than one complaint.
 */
export const SEND_WINDOW = { timeZone: 'America/New_York', startHour: 9, endHour: 20 };

/**
 * Everyone owed a first text right now, oldest capture first.
 *
 * Returns the plan only. Nothing is sent and nothing is written here.
 */
export function planFirstTouch({
  leads = [],
  ledger,
  now = new Date(),
  cap = 5,
  rate = { perHour: 8, perDay: 40 },
  window = SEND_WINDOW,
  killSwitch = false,
}) {
  if (killSwitch) return [];
  if (!isSendingWindow(now, window)) return [];

  const hourLeft = Math.max(0, rate.perHour - ledger.sentSince(HOUR, now.getTime()));
  const dayLeft = Math.max(0, rate.perDay - ledger.sentSince(DAY, now.getTime()));
  const budget = Math.min(cap, hourLeft, dayLeft);
  if (budget <= 0) return [];

  const eligible = leads
    .filter((l) => isPlausiblePhone(l.phone))
    // One first touch per number, ever. `has` covers both "already texted" and
    // "opted out" — an opt-out is written into the same ledger precisely so it
    // can never be re-planned by a later run that forgets to check separately.
    .filter((l) => !ledger.has(l.phone))
    // Oldest first. Without it the same fresh signups win every run and anyone
    // who arrived during a quiet-hours pause never gets reached at all.
    .sort((a, b) => Date.parse(a.created_at ?? 0) - Date.parse(b.created_at ?? 0));

  return eligible.slice(0, budget);
}

/*
 * Opt-out keywords, matched as a whole message rather than anywhere in one.
 * "does it stop working after a year?" is a question about the product, and
 * silently opting that person out loses a live buyer without telling anyone.
 */
const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'stop texting me', 'please stop texting me'];

/** 'stop' or 'question'. Nothing else — there is no third path. */
export function classifyInbound(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!]+$/, '');
  if (STOP_WORDS.includes(t)) return 'stop';
  // A short message that is only an opt-out phrase plus politeness still counts.
  if (/^(please\s+)?(stop|unsubscribe|quit|cancel)\b[\s\w]{0,20}$/.test(t) && !/\?$/.test(t)) return 'stop';
  return 'question';
}

/**
 * The first text. FIXED COPY, not an LLM draft.
 *
 * Same reasoning as knock one on the Instagram side: the identity, the reason
 * we have their number and the opt-out line all have to survive verbatim, and
 * a model paraphrasing any of them is a worse outcome than zero
 * personalisation. It ends on the question Cristiano actually opens with.
 */
export function firstTouchText() {
  return `${FIRST_TOUCH_BODY}\n\nReply STOP to opt out.`;
}

/*
 * The message itself, without the opt-out footer. Split out because the footer
 * is a compliance requirement bolted on the end, and the BODY is what has to
 * end on Cristiano's opening question.
 */
export const FIRST_TOUCH_BODY =
  'Hey, this is Cristiano, founder at Varritech. ' +
  'Your 5 free skills just went to your email. ' +
  'Any questions about them, just text me here. ' +
  'What are you building?';

/*
 * How a text conversation sells. Cristiano, 2026-09-25: "a flowing message,
 * you can't try to sell it right off the bat, it's got to answer his
 * questions." Built from the sales-trainer closer rubric (SPIN discovery,
 * Voss labeling, Daniel G question-first objections, assumptive two-slot ask).
 */
export const SELLING_FRAMEWORK = [
  'HOW YOU SELL OVER TEXT. Follow these stages in order, one step per text.',
  '1. Answer their question first, always, in one or two sentences, before anything else.',
  '2. Discovery. Do not pitch any offer until they have told you a problem. One question per text: what they run, how delivery or leads are handled today, where the team\'s week goes.',
  '3. Cost of the problem: ask what happens if it stays like this, or when they land five more clients. Let them say the value of fixing it in their own words.',
  '4. Label it back ("sounds like the team is the bottleneck"), then give ONE proof that matches their pain, and offer to show it running instead of describing it.',
  '5. Every objection gets a question first, not an answer: price -> "compared to what?", "send me info" -> "what would you need to see to say yes?", "not now" -> "what would need to change?".',
  '6. Only after they have named a pain, ask for a 15 minute call with two time slots, assumptively. Send the booking link only after they pick a time.',
  'Never quote a price unless they ask for it. Never send two texts in a row without a reply.',
].join('\n');

/** The transcript, in the shape a model reads it. */
const renderThread = (thread = []) =>
  thread
    .map((m) => `${m.direction === 'incoming' ? 'THEM' : 'YOU'}: ${String(m.text ?? '').trim()}`)
    .join('\n');

export function buildReplyPrompt({ thread, lead }) {
  return [
    VOICE,
    '',
    SELLING_FRAMEWORK,
    '',
    'OFFER MEMORY. This is the only place you may get a fact from. If the answer is not in here, say you will check and offer a call instead of guessing.',
    'THE OFFER YOU LEAD WITH once they have a problem it solves:',
    workforceBriefing(),
    '',
    'Also in the catalogue:',
    offerBriefing(),
    '',
    `They gave us this email on the landing page: ${lead?.email ?? 'unknown'}. They already have the free 5-skill pack.`,
    '',
    'THE CONVERSATION SO FAR',
    renderThread(thread),
    '',
    'Write YOUR next text. One message, under 45 words, no greeting if you have already said hi.',
    'Never write a placeholder like [name] or {niche}. Write the final text and nothing else.',
  ].join('\n');
}

const hasPlaceholder = (t) => /\[[^\]]+\]|\{[^}]+\}/.test(t);

/** Cristiano does not use them, so neither does anything sent as him. */
const stripEmDashes = (t) => t.replace(/\s*—\s*/g, ', ').replace(/\s*–\s*/g, ', ');

const capWords = (t, max) => {
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= max ? t : words.slice(0, max).join(' ');
};

/**
 * Draft one reply, and refuse to ship it if it breaks a rule.
 *
 * Returns '' for anything unshippable rather than a fixed-up version. An empty
 * draft means this thread is simply left for a human this run, which is always
 * a better outcome than a text that quotes a price we do not charge. The
 * caller must treat '' as "send nothing".
 */
export async function draftReply({ thread, lead, llm }) {
  const raw = String((await llm({ prompt: buildReplyPrompt({ thread, lead }) })) ?? '').trim();
  if (!raw) return '';

  const text = capWords(stripEmDashes(raw), 60).trim();
  if (!text) return '';
  if (hasPlaceholder(text)) return '';

  // ⛔ The three that would actually cost money or trust.
  if (!quotesOnlyKnownPrices(text, SMS_KNOWN_PRICES)) return '';
  if (misattributesVaultPrice(text)) return '';
  if (/\bdiscount|coupon|promo code\b/i.test(text)) return '';

  return text;
}
