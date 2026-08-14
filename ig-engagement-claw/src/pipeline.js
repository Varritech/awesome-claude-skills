// The two operations the CLI exposes, with every external dependency injected
// so the whole path is testable end to end without a browser, a model, or a
// database.

import { parseNotifications } from './notifications.js';
import { newSince } from './seen.js';
import { selectBatch } from './select.js';
import { draftOpener } from './opener.js';
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
  notifications, seen, ledger, llm, cap, rate, now, window: win, killSwitch = false,
}) {
  if (killSwitch) return { killed: true, baseline: false, considered: 0, batch: [] };

  const wasBaseline = seen.isBaseline();
  const targets = newSince(parseNotifications(notifications), seen);
  if (wasBaseline) {
    return { killed: false, baseline: true, considered: 0, batch: [] };
  }

  const batch = selectBatch({ targets, ledger, cap, now, window: win, rate });
  const withOpeners = [];
  for (const target of batch) {
    const text = await draftOpener({ target, llm });
    // An unusable draft (empty, or carrying a template placeholder) means this
    // person is skipped THIS run only — no ledger write, so they come back
    // around next poll with a fresh draft.
    if (!text) continue;
    withOpeners.push({ ...target, text });
  }
  return { killed: false, baseline: false, considered: targets.length, batch: withOpeners };
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

/** A send the agent CONFIRMED landed. Only now does the person become contacted. */
export async function commitSend({ ledger, store, handle, text, igUserId = null, source = null, now = new Date() }) {
  if (ledger.has(handle)) return { recorded: false, reason: 'already-contacted' };
  ledger.record(handle, { at: new Date(now).toISOString(), text, source });
  const where = await recordOpener({ store, target: { handle, igUserId }, text, now: new Date(now).toISOString() });
  return { recorded: true, handoff: where };
}
