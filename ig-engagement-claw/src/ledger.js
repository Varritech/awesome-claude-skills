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
     * How many people we SENT to within the last `windowMs`.
     *
     * Skipped entries (people who already had a thread) deliberately do not
     * count — we never messaged them, so they must not consume send budget.
     */
    sentSince(windowMs, now = Date.now()) {
      const cutoff = now - windowMs;
      return Object.values(entries).filter(
        (e) => e.status !== 'skipped' && e.at && Date.parse(e.at) >= cutoff
      ).length;
    },
    size: () => Object.keys(entries).length,
    all: () => Object.values(entries),
  };
}
