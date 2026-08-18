#!/usr/bin/env node
// The handshake between Node and the browser agent.
//
// Node owns everything that must not be improvised: the ledger, the cap, the
// window, the link-strip, the word cap, the handoff. The agent owns the one
// thing Node can't do — driving the logged-in session — and is never trusted
// to decide WHO gets messaged or WHETHER a send counts.
//
//   1. agent scrapes  -> `next` (stdin: raw scrape JSON)  -> batch + openers
//   2. agent sends each one in the browser
//   3. agent confirms -> `commit <handle>`                -> ledger + handoff
//
// A send the agent never confirms is simply retried next hour.

import { readFileSync } from 'node:fs';
import { createLedger } from './ledger.js';
import { createSeenStore } from './seen.js';
import { planBatch, commitSend, skipTarget } from './pipeline.js';
import { anthropicLlm } from './llm.js';
import { firestoreStore, nullStore } from './firestore-store.js';
import { config } from './config.js';

const cfg = config();
const ledger = createLedger({ path: cfg.statePath });
const readStdin = () => readFileSync(0, 'utf8');

async function getStore() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) return nullStore();
  try { return await firestoreStore(); } catch (e) {
    console.error(`[claw] ⚠ Firestore unavailable (${e.message}) — handoff disabled`);
    return nullStore();
  }
}

const cmd = process.argv[2];

if (cmd === 'next') {
  const result = await planBatch({
    notifications: JSON.parse(readStdin()),
    seen: createSeenStore({ path: cfg.seenPath }),
    ledger,
    llm: anthropicLlm({ apiKey: cfg.anthropicKey, model: cfg.model }),
    cap: cfg.cap,
    rate: cfg.rate,
    exclude: cfg.exclude,
    now: new Date(),
    window: { timeZone: cfg.timeZone, startHour: cfg.startHour, endHour: cfg.endHour },
    followUpDays: cfg.followUpDays,
    killSwitch: cfg.killSwitch,
  });
  console.log(JSON.stringify(result, null, 2));

} else if (cmd === 'commit') {
  const [, , , handle, text = '', igUserId] = process.argv;
  if (!handle) { console.error('usage: cli.js commit <handle> <text> [igUserId]'); process.exit(1); }
  const res = await commitSend({ ledger, store: await getStore(), handle, text, igUserId: igUserId || null });
  console.log(res.recorded ? `recorded: ${handle}` : `already recorded: ${handle}`);

} else if (cmd === 'skip') {
  const [, , , handle, reason = 'existing-thread'] = process.argv;
  if (!handle) { console.error('usage: cli.js skip <handle> [reason]'); process.exit(1); }
  const res = await skipTarget({ ledger, handle, reason });
  console.log(res.recorded ? `skipped: ${handle} (${reason})` : `already known: ${handle}`);

} else if (cmd === 'followup-sent') {
  // A follow-up the agent CONFIRMED landed. Appended to the existing entry, so
  // the original opener and the whole knock history survive.
  const [, , , handle, text = ''] = process.argv;
  if (!handle) { console.error('usage: cli.js followup-sent <handle> <text>'); process.exit(1); }
  ledger.recordFollowUp(handle, { at: new Date().toISOString(), text });
  console.log(`follow-up recorded: ${handle}`);

} else if (cmd === 'replied') {
  // They wrote back. Ends the follow-up chain for good — from here the sales
  // claw owns the conversation and us knocking again would talk over it.
  const [, , , handle] = process.argv;
  if (!handle) { console.error('usage: cli.js replied <handle>'); process.exit(1); }
  ledger.markReplied(handle);
  console.log(`marked replied: ${handle}`);

} else if (cmd === 'ledger') {
  console.log(`${ledger.size()} contacted`);
  for (const e of ledger.all()) {
    const n = (e.followUps ?? []).length;
    const state = e.status === 'skipped' ? `skipped:${e.reason}` : e.replied ? 'REPLIED' : n ? `${n} follow-up(s)` : 'awaiting reply';
    console.log(`  ${e.handle.padEnd(26)} ${e.at ?? ''}  ${state}`);
  }

} else {
  console.error('usage: cli.js next|commit|skip|followup-sent|replied|ledger');
  process.exit(1);
}
