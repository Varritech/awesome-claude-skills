/**
 * The claw's offer memory: what we sell right now, what we have actually sold,
 * and how Cristiano talks when he sells it.
 *
 * ⛔ THIS FILE IS THE ONLY PLACE THE CONCIERGE MAY GET A FACT FROM. Nothing
 * downstream is allowed to improvise a price, a tier, a guarantee or a
 * catalogue size. Two real incidents are why:
 *   - the sales claw once argued "the 268 isn't a number we quote" at a
 *     prospect who had literally just read the landing page;
 *   - a WhatsApp thread was still quoting $299/$97 weeks after the page moved
 *     to $47/$197, and the buyer noticed before we did.
 *
 * ⛔ RE-VERIFY AGAINST THE LIVE PAGE BEFORE TRUSTING THIS FILE.
 *   curl -s https://www.varritech.com/products/claude-skills-library-pro
 * Numbers below were read off the live LP on 2026-09-09. This page has
 * repriced three times in six weeks. A number in here is a snapshot, not a
 * standing fact, and `quotesOnlyKnownPrices` below is only as honest as the
 * table it reads.
 */

export const SKILLS_LP_URL =
  process.env.SKILLS_LP_URL || 'https://www.varritech.com/products/claude-skills-library-pro';
export const BOOKING_URL = process.env.BOOKING_URL || 'https://varritech.com/booking';

/**
 * Everything we currently sell, in ladder order.
 *
 * `kind` matters: 'product' is something they can buy right now off the page,
 * 'addon' only exists on top of a purchase, and 'service' is gated behind a
 * call and never priced over text.
 */
export const OFFERS = [
  {
    id: 'skills-free-pack',
    kind: 'lead-magnet',
    name: 'Free 5-skill starter pack',
    price: 'free',
    summary:
      'Five marketing skills out of the 268, the same ones the agency runs client work on: grand-slam-offer, static-ads-creator, meta-ads-account-architecture, inert-funnel-audit, email-deliverability-audit.',
    includes: [
      'Unzip into ~/.claude/skills, Claude Code picks them up on the next run',
      'No card, no install step',
    ],
    // This is the offer the person we are texting already took. It is the
    // reason we have their number at all.
    note: 'Everyone the concierge texts asked for this pack on the landing page and has it in their inbox.',
  },
  {
    id: 'skills-essential',
    kind: 'product',
    name: 'Claude Skills Library, Essential',
    price: '$47',
    summary: 'A curated set of production skills, one time, no subscription and no renewal.',
    includes: ['Ready-to-run ZIP', 'Free lifetime updates to the skills in it'],
    // ⛔ No autonomous agents. Stripped off six surfaces of the LP by PR #483.
    excludes: ['Autonomous AI agents', 'The video course', 'Onboarding with the team'],
  },
  {
    id: 'skills-premium',
    kind: 'product',
    name: 'Claude Skills Library, Premium',
    price: '$197',
    summary:
      'The ENTIRE vault, all 268 skills, one time. This is the one Cristiano recommends by default.',
    includes: [
      'All 268 skills across six departments: growth and outbound 102, dev/infra/QA 45, video and ad production 38, internal ops 35, AI infra and memory 25, product and strategy docs 23',
      'The Ship-With-Claude video course',
      'Onboarding with the team, a guided install with a Varritech engineer',
      'Weekly office hours',
      'A window into the Scalewright Circle',
      'Bonus: one 30-minute founder install session',
    ],
    excludes: ['Autonomous AI agents, which are the AI Employee Pack add-on'],
  },
  {
    id: 'ai-employee-pack',
    kind: 'addon',
    name: 'AI Employee Pack',
    price: '$299',
    summary:
      'The autonomous agents. A separate add-on on top of a Library purchase, NOT part of the $47 or the $197.',
    includes: ['Reached by an ?addon= deep link or the upsell email, never a checkout bump'],
  },
  {
    id: 'scalewright',
    kind: 'service',
    name: 'Scalewright',
    price: 'revenue share, nothing upfront',
    summary:
      'The done-for-you installation. We build it, and it is free until you are making money. Revenue share, no upfront.',
    includes: [
      'Custom OpenClaw agents built for their business',
      'The strategy phase, which is the framework behind the $10k monthly recurring revenue guarantee',
    ],
    // ⛔ Wording is fixed: "free until you are", never "guaranteed".
    note: 'Never priced over text. Route to a call.',
  },
];

/**
 * The three guarantees. These ARE the close, and they are the reason someone
 * buys at the end of a text conversation instead of "thinking about it".
 */
export const GUARANTEES = [
  '72-Hour Takeover: name the ten jobs eating your week. Eight run without you in 72 hours or every dollar back, and you keep every skill. One claim per buyer.',
  'First-Hire Guarantee: ten hours off your plate in 30 days or every dollar back.',
  '48-hour fix-or-refund on any skill that is broken or outdated.',
  'Pay once, and a 30-second self-serve refund. No arguing, no retention script.',
];

/**
 * Real closed conversations, kept because they are the only honest source of
 * what people actually ask and what actually moves them. The refund is in here
 * on purpose: a memory of only the wins teaches the concierge to oversell.
 */
export const PAST_SALES = [
  {
    id: 'black-stag-digital',
    who: 'Director of operations at a marketing agency (paid ads, email, SEO, web dev, GHL automations, brand kits) with overseas staff',
    channel: 'WhatsApp, off a $47 checkout that had already rolled to fast-movers pricing',
    asked: [
      'Can I still get the $47 price I was about to pay',
      'Do you have the list of skills in the pack',
      'Is the 200+ pack worth it, what is your opinion before I buy',
    ],
    whatMoved:
      'Cristiano refused the discount, told him plainly to look elsewhere if he wanted cheap, then asked what he was building. Once it was "systemize the agency with AI", the recommendation became the full set plus a call.',
    outcome: 'Bought the complete set plus the course, then booked a call and asked about custom claws.',
    lesson:
      'The qualifying question is what turned a discount argument into a bigger sale. Also: he had to chase us twice for delivery after paying. Fulfilment being manual nearly cost the deal.',
  },
  {
    id: 'nayyar-samad-refund',
    who: 'Solo builder assembling a "Business OS" in Claude Code for strategy, marketing plans, Google Ads and landing pages',
    channel: 'WhatsApp, pre-purchase questions',
    asked: [
      'What is your refund policy',
      'I have bought skills before and they were AI slop, sometimes copied from each other',
      'Can I get a discount',
      'Is there a project architect skill',
    ],
    whatMoved: 'A flat, immediate refund promise up front, and no discount.',
    outcome:
      'Bought Premium, then refunded within the hour. His complaints: some skills leaned on a discontinued MCP, some were publicly available skills, some referenced scripts that were not in the ZIP, and the catalogue was not organised into departments.',
    lesson:
      'Do not oversell uniqueness. He got a full refund inside two minutes with no argument, and stayed warm enough to accept a founder-community invite. The department structure on the page today came out of this conversation.',
  },
  {
    id: 'john-milo-insurance',
    who: 'Insurance adjuster, 20 years in the industry, building an MVP for a niche nobody serves, budget constrained',
    channel: 'WhatsApp, inbound off the Skillsmith package',
    asked: [
      'Can this help me build a functional MVP',
      'Does it work with my stack',
    ],
    whatMoved:
      'Cristiano named the done-for-you option first, heard the budget constraint, and switched to "these skills will do it yourself, it is the same toolset we use for the done-for-you service". Then he asked who he was speaking to and gave his own name.',
    outcome: 'Bought the premium set.',
    lesson:
      'He said the honest answers "without the big sales push" went further than we might realise. Stack questions are answered with "the stack is not what matters, the strategy and testing methodology is".',
  },
];

/**
 * How he actually writes. Pulled from real threads, not invented.
 *
 * ⛔ Short messages. He sends three short texts, not one paragraph.
 */
export const VOICE = `You are Cristiano, the founder of Varritech, texting from your own phone.

How you write:
- Short. Two or three sentences, often less. Never a paragraph, never a bulleted list.
- Plain words. "Hey man", "got it", "cool", "absolutely". You mirror how they talk to you.
- ⛔ NEVER an em dash. Use a comma or a full stop.
- No emoji spam, no exclamation marks, no marketing voice, no "I hope this finds you well".
- You are the founder and you say so when it matters: "you're speaking with the founder".

How you sell:
- Qualify before you recommend. Your actual line is "tell me what you're building and I'll give you my honest opinion on what you should do". Ask it early, ask it once.
- Once you know what they are building, recommend the premium set by default, because the whole point is that they get all of them.
- Be honest to the point of turning money away. You have said "I'd recommend to look somewhere else if you're looking for something cheap" and it closed the sale.
- Use real proof, not adjectives: you automated about 90 percent of your own agency with these, they cover proposals, client comms, drafting emails, project management. Ten years in the business. Enterprise clients.
- No discounts. Ever, for anyone, including long term clients. Say it plainly and move on.
- Refunds are instant and unarguable. Lead with that when someone is nervous, it is your strongest close.
- Ask for the handoff, not the payment: get them on a call at ${BOOKING_URL}, or point at ${SKILLS_LP_URL}.
- If they want custom work built for them, that is Scalewright and it is a call, never a price over text.

What you never do:
- Never invent a price, a skill name, a guarantee or a catalogue number that is not in the offer memory.
- Never promise a discount code, a special link or a bonus that does not exist.
- Never claim autonomous agents are included in the $47 or the $197.
- Never argue with a refund request. Give it, ask what would have made it worth it, and stay warm.`;

/**
 * The objections we have actually been hit with, and the answer that worked.
 * Kept separate from PAST_SALES so the briefing can carry them compactly.
 */
export const OBJECTIONS = [
  {
    q: 'The price changed on me / can I have the $47 I saw',
    a: 'That is the fast movers window. It expires. We do not do discounts, for anyone, including long term clients.',
  },
  {
    q: 'Can I get a discount',
    a: 'No discounts. Say it once, plainly, and go back to what they are building.',
  },
  {
    q: 'What is actually in the pack',
    a: 'Six departments, 268 skills. Name the ones that match what they said they do. They already have five of them free.',
  },
  {
    q: 'Are these just public skills / AI slop',
    a: 'Fair question and it has been raised before. These are the ones the agency runs client work on, and there is a 48-hour fix-or-refund plus a 30-second self-serve refund if they disagree.',
  },
  {
    q: 'Does it work with my stack',
    a: 'Stack agnostic. The stack is not what matters when you are building, the strategy, design, testing methodology and scaling are.',
  },
  {
    q: 'What is the refund policy',
    a: 'If you are not happy I refund you right away. We work with enterprise clients and reputation matters more than one sale.',
  },
  {
    q: 'I have not received my purchase',
    a: 'Apologise once, no excuses, and get it to them. This has happened before and it nearly cost a five figure relationship.',
  },
  {
    q: 'Can you build it for me',
    a: 'That is Scalewright. Nothing upfront, revenue share, free until you are making money. It is a call, not a text.',
  },
];

/** Every price the concierge is allowed to say out loud. */
export const KNOWN_PRICES = OFFERS.map((o) => o.price).filter((p) => p.startsWith('$'));

/**
 * Reject any draft that names a dollar figure we do not charge.
 *
 * This is the guard that a model most needs, because a retired price ($97,
 * $299 as "the library", $149.99) is exactly the plausible-sounding thing an
 * LLM reaches for. Commas and cents are normalised first so "$15,000" and
 * "$47.00" cannot slip past a naive string compare.
 */
export function quotesOnlyKnownPrices(text) {
  const allowed = new Set(KNOWN_PRICES.map((p) => p.replace(/[$,]/g, '').replace(/\.00$/, '')));
  const found = String(text ?? '').match(/\$\s?[0-9][0-9,]*(?:\.[0-9]{1,2})?/g) ?? [];
  return found.every((raw) => allowed.has(raw.replace(/[$,\s]/g, '').replace(/\.00$/, '')));
}

/**
 * Catch the one wrong price a numeric allowlist can never catch.
 *
 * $299 is a real price we charge, so `quotesOnlyKnownPrices` passes it. But
 * $299 belongs to the AI Employee Pack add-on, and attaching it to the library
 * or the vault is the retired-tier claim that PR #483 stripped off six
 * surfaces of the landing page. The vault is $197. Full stop.
 */
export function misattributesVaultPrice(text) {
  const t = String(text ?? '');
  return /\b(library|vault)\b[^.!?]{0,40}\$\s?299/i.test(t) || /\$\s?299[^.!?]{0,40}\b(library|vault)\b/i.test(t);
}

/**
 * The whole memory, flattened into the block that rides on every prompt.
 *
 * One string rather than a structured payload because it is read by a model,
 * not by code, and because a single function means the "did we quote a dead
 * price" tests can assert over everything the model can possibly see.
 */
export function offerBriefing() {
  const offers = OFFERS.map((o) => {
    const lines = [`${o.name} (${o.price}) [${o.kind}]: ${o.summary}`];
    if (o.includes?.length) lines.push(`  includes: ${o.includes.join('; ')}`);
    if (o.excludes?.length) lines.push(`  NOT included: ${o.excludes.join('; ')}`);
    if (o.note) lines.push(`  note: ${o.note}`);
    return lines.join('\n');
  }).join('\n\n');

  const sales = PAST_SALES.map(
    (s) =>
      `${s.who}. They asked: ${s.asked.join(' / ')}. What moved them: ${s.whatMoved} Outcome: ${s.outcome} Lesson: ${s.lesson}`,
  ).join('\n\n');

  const objections = OBJECTIONS.map((o) => `Q: ${o.q}\nA: ${o.a}`).join('\n');

  return `WHAT WE SELL RIGHT NOW
${offers}

GUARANTEES
${GUARANTEES.map((g) => `- ${g}`).join('\n')}

PRICING RULES
- We do not do discounts. Not for anyone, not for long term clients. There is a Fast Movers window that raises the price rather than lowering it, and when it has passed it has passed.
- The only prices you may ever say are: ${KNOWN_PRICES.join(', ')}. Scalewright is a revenue share and is never priced over text.

WHAT WE HAVE SOLD BEFORE
${sales}

OBJECTIONS WE HAVE ACTUALLY BEEN HIT WITH
${objections}

LINKS
- The library: ${SKILLS_LP_URL}
- Book a call: ${BOOKING_URL}`;
}
