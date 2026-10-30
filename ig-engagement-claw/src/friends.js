// Anyone following Cristiano's personal @varriale.cristiano is a friend of his,
// not a lead (Cristiano, 2026-10-30). The browser agent fetches the lookup; the
// verdict lives here, so the agent never decides who counts as a friend.

import { normalizeHandle } from './handle.js';

const REASON = 'personal-friend';

/**
 * Reads the /friendships/<id>/followers/?query=<handle> response.
 *
 * ⛔ 'unknown' is its own answer. A rate-limited or failed lookup says nothing
 * about the person, and reading it as 'clear' would DM a friend.
 */
export function friendVerdict(response, handle) {
  if (response?.status !== 'ok' || !Array.isArray(response.users)) return 'unknown';
  // The query is a substring search, so only an exact username counts.
  const target = normalizeHandle(handle);
  return response.users.some((u) => normalizeHandle(String(u?.username ?? '')) === target) ? 'friend' : 'clear';
}

/**
 * Verdict plus the ledger write: a friend is shut out of openers AND follow-ups.
 *
 * ⛔ `blocked` is what stops the follow-ups. dueForFollowUp reopens plain
 * `skipped` rows on purpose, so a skip alone would knock on the friend later.
 */
export function applyFriendCheck({ ledger, handle, response, source, now = new Date() }) {
  // A commenter gets messaged even if they follow him (Cristiano, 2026-10-30).
  // This claw is the only route to them. Follow-ups pass no source, so the
  // exemption covers the one opener and a friend is not knocked on after it.
  if (source === 'commenter') return 'clear';
  const verdict = friendVerdict(response, handle);
  if (verdict !== 'friend') return verdict;
  if (ledger.has(handle)) ledger.markBlocked(handle, REASON);
  else ledger.record(handle, { status: 'skipped', reason: REASON, at: new Date(now).toISOString(), blocked: true, blockedReason: REASON });
  return verdict;
}
