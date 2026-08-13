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
    withOpeners.push({ ...target, text: await draftOpener({ target, llm }) });
  }
  return { killed: false, considered: targets.length, batch: withOpeners };
}

/** A send the agent CONFIRMED landed. Only now does the person become contacted. */
export async function commitSend({ ledger, store, handle, text, igUserId = null, source = null, now = new Date() }) {
  if (ledger.has(handle)) return { recorded: false, reason: 'already-contacted' };
  ledger.record(handle, { at: new Date(now).toISOString(), text, source });
  const where = await recordOpener({ store, target: { handle, igUserId }, text, now: new Date(now).toISOString() });
  return { recorded: true, handoff: where };
}
