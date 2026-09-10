// Follow-ups: the second (and last) knock, for people who never answered.
//
// The engagement claw is the ONLY place this can live. The sales claw
// (~/instagram-claw) is webhook-driven — it has nothing but /webhook routes, so
// it can react to a message but can never start one. This claw already has the
// three things a follow-up needs: a schedule, a ledger of who we opened and
// when, and a browser session that can see whether they ever wrote back.

const DAY = 86400_000;

/**
 * Days of silence before each knock, measured from the PREVIOUS message we sent
 * — not from the opener. Two entries means at most two follow-ups, ever.
 *
 * Deliberately slow. These people did not ask to hear from us; they liked a post.
 * A same-week double-tap reads as automation and is what gets an account limited.
 */
export const DEFAULT_CADENCE_DAYS = [3, 7];

/** Whole days between two instants, floored. */
const daysBetween = (fromIso, now) => Math.floor((now.getTime() - Date.parse(fromIso)) / DAY);

/**
 * Everyone owed a follow-up right now, longest-silent first.
 *
 * Returns the plan only — nothing is sent and nothing is written here. The agent
 * still has to open the thread, confirm with its own eyes that they never
 * replied, send, and come back to `cli.js followup-sent`.
 */
export function dueForFollowUp({ ledger, now = new Date(), cadenceDays }) {
  const cadence = cadenceDays ?? DEFAULT_CADENCE_DAYS;
  const due = [];
  for (const e of ledger.all()) {
    /*
     * ⛔ REOPENED 2026-09-10 (Cristiano: "it should follow up with literally
     * everyone who we've ever talked to on IG"). A `skipped` row is someone who
     * ALREADY had a DM thread with him before this claw existed — 34 of them,
     * and the claw had never messaged a single one. They are the closest thing
     * we have to "everyone we've ever talked to", so they are now in scope.
     *
     * The one skip we keep: DMs actually shut. That is a wall, not a choice.
     */
    const reopen = e.status === 'skipped';
    if (reopen && /dms?-closed|closed|blocked|restrict/i.test(String(e.reason ?? ''))) continue;
    // They answered. The sales claw owns this conversation now; barging in talks over it.
    if (e.replied) continue;
    // We messaged them, but delivery is permanently blocked. Re-knocking just reopens a dead thread.
    if (e.blocked) continue;
    if (!e.at) continue;

    const sent = e.followUps ?? [];

    /*
     * ⛔ No retirement. This used to stop for good once the named cadence was
     * spent, which had frozen out 36 people permanently. Past the last named
     * step the FINAL interval repeats forever, so an exhausted thread is never
     * knocked faster than a fresh one — it just never stops being knocked.
     */
    const step = sent.length < cadence.length ? cadence[sent.length] : cadence[cadence.length - 1];

    const lastAt = sent.length ? sent[sent.length - 1].at : e.at;
    if (daysBetween(lastAt, now) < step) continue;

    due.push({
      handle: e.handle,
      followUpNumber: sent.length + 1,
      opener: e.text,
      silentDays: daysBetween(e.at, now),
      // ⛔ Load-bearing: knock one branches on this. A commenter gets the Skills
      // Library, everyone else gets the guide. Dropping it here silently sent
      // every commenter the wrong pitch.
      source: e.source ?? null,
      // No opener exists for a reopened thread — we never sent one. The copy
      // must not say "following up on my message".
      reopen,
    });
  }
  // Longest-silent first: without this the same fresh names win every run and
  // the people closest to being written off never get their second knock.
  return due.sort((a, b) => b.silentDays - a.silentDays);
}
