/**
 * Reply classification categories and keyword-based classifier.
 *
 * ReplyCategory – the 8 canonical buckets for incoming reply classification.
 * CATEGORY_KEYWORDS – keyword lists used for lightweight classification.
 * classifyByKeywords – best-match classifier, defaults to 'interested'.
 */

export type ReplyCategory =
  | "interested"
  | "not_interested"
  | "do_not_contact"
  | "auto_reply"
  | "out_of_office"
  | "referral"
  | "question"
  | "booked";

export const CATEGORY_KEYWORDS: Record<ReplyCategory, string[]> = {
  interested: [
    "interested",
    "tell me more",
    "sounds good",
    "sounds interesting",
    "love to learn",
    "open to",
    "would like",
    "let me know",
    "please share",
    "curious",
    "more info",
    "schedule",
    "set up a call",
    "connect",
    "reach out",
    "happy to chat",
    "glad to discuss",
    "follow up",
  ],
  not_interested: [
    "not interested",
    "no thank you",
    "no thanks",
    "pass",
    "not for us",
    "not a fit",
    "not the right time",
    "not relevant",
    "already have",
    "not looking",
    "not in our budget",
    "decided against",
    "going with someone else",
    "appreciate it but",
    "don't need",
    "remove me",
  ],
  do_not_contact: [
    "do not contact",
    "stop emailing",
    "stop contacting",
    "cease and desist",
    "unsubscribe",
    "opt out",
    "opt-out",
    "take me off",
    "remove from list",
    "never email me",
    "spam",
    "harassment",
    "report",
    "legal",
    "attorney",
    "lawsuit",
    "do not email",
  ],
  auto_reply: [
    "automatic reply",
    "auto reply",
    "auto-reply",
    "this is an automated",
    "automated message",
    "automated response",
    "do not reply to this email",
    "noreply",
    "no-reply",
    "this message was sent automatically",
    "autoreply",
  ],
  out_of_office: [
    "out of office",
    "out of the office",
    "on vacation",
    "on leave",
    "away from",
    "currently away",
    "i will be back",
    "will return",
    "limited access",
    "away until",
    "office holiday",
    "parental leave",
    "sabbatical",
    "annual leave",
  ],
  referral: [
    "you should talk to",
    "refer you to",
    "reach out to",
    "better contact",
    "speak with",
    "connect you with",
    "forward your email",
    "cc",
    "cc'd",
    "introducing",
    "looping in",
    "put you in touch",
    "best person",
    "right person",
    "point of contact",
  ],
  question: [
    "question",
    "can you explain",
    "how does",
    "what is",
    "what are",
    "how much",
    "what does it cost",
    "pricing",
    "do you offer",
    "is it possible",
    "can you",
    "could you",
    "would you",
    "do you have",
    "can this",
    "does this work",
    "clarify",
    "wondering if",
  ],
  booked: [
    "booked",
    "confirmed",
    "scheduled",
    "meeting confirmed",
    "appointment confirmed",
    "calendar invite",
    "see you then",
    "see you on",
    "looking forward to our call",
    "looking forward to meeting",
    "calendly",
    "zoom link",
    "meeting link",
    "google meet",
  ],
};

/**
 * Classify an email reply body by counting keyword matches per category.
 * Returns the category with the highest match count.
 * Falls back to 'interested' when no keywords match or there is a tie.
 *
 * Scoring note: multi-word phrases score 2× single words to prevent the
 * word "interested" from outscoring "not interested".
 */
export function classifyByKeywords(body: string): ReplyCategory {
  const lower = body.toLowerCase();

  const scores: Record<ReplyCategory, number> = {
    interested: 0,
    not_interested: 0,
    do_not_contact: 0,
    auto_reply: 0,
    out_of_office: 0,
    referral: 0,
    question: 0,
    booked: 0,
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    ReplyCategory,
    string[],
  ][]) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (lower.includes(kwLower)) {
        // Multi-word phrases get higher weight so they beat single-word partial matches
        const wordCount = kwLower.split(/\s+/).length;
        scores[category] += wordCount;
      }
    }
  }

  let best: ReplyCategory = "interested";
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores) as [ReplyCategory, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}
