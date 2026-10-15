// Who is worth a connection request.
//
// The offer is a done-for-you AI agent build, free up front, paid only if it
// worked. That only makes sense to someone who owns the operation and can say
// yes: a founder or owner of a business that is already running. Everyone else
// is a wasted invite out of a daily allowance LinkedIn rations hard.

const DECISION_MAKER_RE = /\b(founder|co-?founder|owner|co-?owner|ceo|chief executive|president|managing (?:director|partner)|principal|proprietor)\b/i;

// Checked before the title, so "Recruiter | Hiring Founders" or "Former CEO"
// never passes on the strength of the word it contains.
const DISQUALIFY_RE = /\b(recruit\w*|talent acquisition|student|intern|aspiring|open to work|seeking|looking for (?:work|opportunities|a role)|former|ex-|retired)\b/i;

export function matchesIcp({ headline = '' } = {}) {
  const h = String(headline);
  if (DISQUALIFY_RE.test(h)) return false;
  return DECISION_MAKER_RE.test(h);
}
