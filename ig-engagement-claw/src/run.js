// One hourly pass.
//
// Order is deliberate and load-bearing:
//   send -> THEN ledger -> THEN handoff.
// Recording before a confirmed send would burn the lead permanently on a
// transient IG error; recording after means a failure is simply retried next
// hour. Same rule the sales claw learned the hard way with appendOutbound.

import { collectTargets } from './targets.js';
import { selectBatch } from './select.js';
import { draftOpener } from './opener.js';
import { recordOpener } from './handoff.js';

export async function runOnce({
  drive, ledger, llm, store, send, sleep,
  cap = 8, now = new Date(), window: win, log = () => {}, killSwitch = false,
}) {
  if (killSwitch) {
    log('[claw] KILL_SWITCH on - no sends this run');
    return { considered: 0, selected: 0, sent: 0, failed: 0, killed: true };
  }

  const targets = await collectTargets({ drive, now: new Date(now).toISOString() });
  const batch = selectBatch({ targets, ledger, cap, now, window: win });

  let sent = 0;
  let failed = 0;

  for (const target of batch) {
    const text = await draftOpener({ target, llm });
    try {
      await send({ ...target, text });
    } catch (err) {
      failed += 1;
      log(`[claw] SEND FAILED ${target.handle}: ${err.message}`);
      continue; // not recorded -> retried next hour
    }
    sent += 1;
    ledger.record(target.handle, { source: target.source, postId: target.postId ?? null, at: new Date(now).toISOString(), text });
    await recordOpener({ store, target, text });
    log(`[claw] SENT ${target.handle} (${target.source})`);
    await sleep();
  }

  return { considered: targets.length, selected: batch.length, sent, failed };
}
