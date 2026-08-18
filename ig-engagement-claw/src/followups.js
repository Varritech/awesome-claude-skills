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
    // Never messaged them (existing thread, DMs closed, blocked) — nothing to follow up ON.
    if (e.status === 'skipped') continue;
    // They answered. The sales claw owns this conversation now; barging in talks over it.
    if (e.replied) continue;
    if (!e.at) continue;

    const sent = e.followUps ?? [];
    if (sent.length >= cadence.length) continue; // cadence exhausted, stop for good

    const lastAt = sent.length ? sent[sent.length - 1].at : e.at;
    if (daysBetween(lastAt, now) < cadence[sent.length]) continue;

    due.push({
      handle: e.handle,
      followUpNumber: sent.length + 1,
      opener: e.text,
      silentDays: daysBetween(e.at, now),
    });
  }
  // Longest-silent first: without this the same fresh names win every run and
  // the people closest to being written off never get their second knock.
  return due.sort((a, b) => b.silentDays - a.silentDays);
}
