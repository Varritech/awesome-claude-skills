// The two operations the CLI exposes, with every external dependency injected
// so the whole path is testable end to end without a browser, a model, or a
// database.

import { collectTargets } from './targets.js';
import { selectBatch } from './select.js';
import { draftOpener } from './opener.js';
import { recordOpener } from './handoff.js';

/** Raw scrape in -> the exact people to message, each with a finished opener. */
export async function planBatch({ scrape, ledger, llm, cap, now, window: win, killSwitch = false }) {
  if (killSwitch) return { killed: true, considered: 0, batch: [] };
  const drive = async (step) => scrape[step.op] ?? [];
  const targets = await collectTargets({ drive, now: new Date(now).toISOString() });
  const batch = selectBatch({ targets, ledger, cap, now, window: win });
  const withOpeners = [];
  for (const target of batch) {
    const text = await draftOpener({ target, llm });
    // An unusable draft (empty, or carrying a template placeholder) means this
    // person is skipped THIS run only — no ledger write, so they come back
    // around next poll with a fresh draft.
    if (!text) continue;
    withOpeners.push({ ...target, text });
  }
  return { killed: false, considered: targets.length, batch: withOpeners };
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
