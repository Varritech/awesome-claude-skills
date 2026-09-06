// The two operations the CLI exposes, with every external dependency injected
// so the whole path is testable end to end without a browser, a model, or a
// database.

import { parseNotifications } from './notifications.js';
import { newSince } from './seen.js';
import { selectBatch, isSendingWindow, remainingBudget } from './select.js';
import { draftOpener, draftFollowUp } from './opener.js';
import { dueForFollowUp } from './followups.js';
import { recordOpener } from './handoff.js';

/**
 * Raw notification rows in -> the exact people to message, each with a finished
 * opener.
 *
 * The claw watches the notifications feed and messages the DIFF. The first call
 * ever made is a silent baseline (see newSince) — it records where we stood and
 * plans nobody, so installing this doesn't cold-DM the entire backlog at once.
 */
export async function planBatch({
  notifications, seen, ledger, llm, cap, rate, now, window: win, exclude, killSwitch = false, followUpDays,
  linksBlocked = false,
}) {
  if (killSwitch) return { killed: true, baseline: false, considered: 0, batch: [], followUps: [] };

  const wasBaseline = seen.isBaseline();
  const targets = newSince(parseNotifications(notifications), seen);
  if (wasBaseline) {
    return { killed: false, baseline: true, considered: 0, batch: [], followUps: [] };
  }

  // ⛔ Cold openers are picked FIRST and take budget before any follow-up.
  // REVERSED 2026-09-04 on Cristiano's instruction. It used to be the other way
  // round, on the reasoning that "there is always another liker, but a person
  // only goes quiet once" — in practice that starved cold outreach completely:
  // the claw went 2026-08-31 → 09-04 without opening a single new person while
  // still knocking on people from August. Reaching someone in the minutes after
  // they follow or like is the entire reason this polls every 5 minutes; a
  // second knock on a 5-day-old silence keeps just as well on a quieter run.
  const batch = selectBatch({ targets, ledger, cap, now, window: win, rate, exclude });
  const withOpeners = [];
  for (const target of batch) {
    const text = await draftOpener({ target, llm });
    // An unusable draft (empty, or carrying a template placeholder) means this
    // person is skipped THIS run only — no ledger write, so they come back
    // around next poll with a fresh draft.
    if (!text) continue;
    withOpeners.push({ ...target, text });
  }

  // Follow-ups get whatever cold outreach did not use. `alreadyPlanned` counts
  // the DRAFTED openers, not the selected ones — a target whose draft came back
  // unusable is not going to be sent, so it must not hold a slot hostage.
  const followUps = [];
  if (isSendingWindow(now, win)) {
    let left = remainingBudget({ ledger, rate, cap, alreadyPlanned: withOpeners.length });
    for (const target of dueForFollowUp({ ledger, now, cadenceDays: followUpDays })) {
      if (left <= 0) break;
      const text = await draftFollowUp({ target, llm, linksBlocked });
      if (!text) continue; // unusable draft — they come back around next run
      followUps.push({ ...target, text });
      left -= 1;
    }
  }
  return { killed: false, baseline: false, considered: targets.length, batch: withOpeners, followUps };
}

/**
 * Someone we looked at and decided NOT to message — almost always because they
 * already have a DM thread with us.
 *
 * "Only message people who haven't been messaged" is broader than this claw's
 * own history: Cristiano has years of existing threads, and the sales claw
 * opens more every day. The ledger can only see what IT sent, so the agent
 * checks the opened thread for prior messages and reports back here.
 *
 * Recorded as `status:'skipped'` so `has()` blocks them forever but
 * `sentSince()` ignores them — we never sent, so they must not eat send budget.
 */
export async function skipTarget({ ledger, handle, reason, now = new Date() }) {
  if (ledger.has(handle)) return { recorded: false, reason: 'already-known' };
  ledger.record(handle, { status: 'skipped', reason, at: new Date(now).toISOString() });
  return { recorded: true };
}

/**
 * The opposite case from skipTarget: someone we DID already message (an
 * opener or a follow-up is on record), whose thread now shows "can't receive
 * your message... don't allow new message requests from everyone" — a
 * permanent wall, not a delay. skipTarget can't record this because
 * ledger.has() is already true; without this, the same dead thread comes due
 * for another knock every run forever (recurred on pbjoel three separate
 * times before this existed).
 */
export async function blockTarget({ ledger, handle, reason, now = new Date() }) {
  if (!ledger.has(handle)) return { recorded: false, reason: 'no-opener-on-record' };
  ledger.markBlocked(handle, reason);
  return { recorded: true };
}

/**
 * A send the agent CONFIRMED landed. Only now does the person become contacted.
 *
 * ⛔ The ledger write comes FIRST and the handoff is never allowed to throw past
 * it. By the time this runs the DM is already sitting in someone's Instagram
 * inbox — if a Firestore outage escaped here the run would die un-recorded and
 * the next poll would message a real person a second time. Losing the handoff
 * costs us a founder re-introduction; losing the ledger write costs us the
 * relationship. Proven live 2026-08-17 when ADC went stale mid-run.
 */
export async function commitSend({ ledger, store, handle, text, igUserId = null, source = null, now = new Date() }) {
  if (ledger.has(handle)) return { recorded: false, reason: 'already-contacted' };
  ledger.record(handle, { at: new Date(now).toISOString(), text, source });
  try {
    const where = await recordOpener({ store, target: { handle, igUserId }, text, now: new Date(now).toISOString() });
    return { recorded: true, handoff: where };
  } catch (err) {
    const handoffError = String(err?.message ?? err);
    console.error(`[claw] ⚠ HANDOFF FAILED for ${handle} (${handoffError}) — send IS recorded, sales claw will re-introduce the founder on reply`);
    return { recorded: true, handoff: null, handoffError };
  }
}
