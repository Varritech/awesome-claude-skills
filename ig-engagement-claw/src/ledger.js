// Contacted-ledger — the "if we haven't done it before" rule, made durable.
//
// One handle in here = we have already opened a conversation with that person.
// Nothing re-opens. This file is the ONLY thing standing between the claw and
// re-DMing the same person every hour, so it is written before anything else
// and read on every run.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeHandle as normalize } from './handle.js';


export function createLedger({ path }) {
  let entries = {};
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    entries = {}; // no ledger yet, or unreadable -> start empty
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(entries, null, 2));
  };

  return {
    has: (handle) => Object.hasOwn(entries, normalize(handle)),
    record(handle, meta = {}) {
      entries[normalize(handle)] = { handle: normalize(handle), ...meta };
      persist();
    },
    /**
     * A second (or third) message to someone already in the ledger.
     *
     * Appended, never overwritten — the original opener has to survive so the
     * follow-up can reference it and so we can see the whole history later.
     */
    recordFollowUp(handle, { at, text }) {
      const key = normalize(handle);
      const entry = entries[key];
      // A follow-up to someone with no opener on record would be a cold DM
      // wearing a follow-up's clothes. Refuse loudly rather than invent history.
      if (!entry) throw new Error(`cannot follow up ${key}: no opener on record`);
      entry.followUps = [...(entry.followUps ?? []), { at, text }];
      persist();
    },

    /** They wrote back. Stops the follow-up chain for good. */
    markReplied(handle) {
      const key = normalize(handle);
      if (!entries[key]) return;
      entries[key].replied = true;
      persist();
    },

    /**
     * How many messages we SENT within the last `windowMs`.
     *
     * Skipped entries (people who already had a thread) deliberately do not
     * count — we never messaged them, so they must not consume send budget.
     *
     * ⛔ Follow-ups DO count, each on its own timestamp. They are real DMs from
     * the same account, and a backlog of them coming due together would
     * otherwise sail straight past MAX_PER_HOUR in one run.
     */
    sentSince(windowMs, now = Date.now()) {
      const cutoff = now - windowMs;
      let n = 0;
      for (const e of Object.values(entries)) {
        if (e.status === 'skipped') continue;
        if (e.at && Date.parse(e.at) >= cutoff) n += 1;
        for (const f of e.followUps ?? []) {
          if (f.at && Date.parse(f.at) >= cutoff) n += 1;
        }
      }
      return n;
    },
    size: () => Object.keys(entries).length,
    all: () => Object.values(entries),
  };
}
