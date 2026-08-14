// The "mental snapshot" of the notifications feed.
//
// Separate from the contacted-ledger on purpose, because they answer different
// questions:
//   seen store -> "have I already LOOKED at this notification?"
//   ledger     -> "have I already MESSAGED this person?"
// A notification can be seen-but-not-messaged (budget was spent, or they had an
// existing thread). Collapsing the two would silently lose one of those states.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** One notification event. Same person liking two posts is two events. */
export const keyOf = (n) => `${n.source}:${n.handle}:${n.postId ?? ''}`;

export function createSeenStore({ path }) {
  let keys;
  try {
    keys = new Set(JSON.parse(readFileSync(path, 'utf8')).keys);
  } catch {
    keys = null; // no snapshot yet — this is a first look
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ keys: [...(keys ?? [])] }, null, 2));
  };

  return {
    /** True until the very first snapshot is taken. */
    isBaseline: () => keys === null,
    has: (key) => (keys ?? new Set()).has(key),
    remember(newKeys) {
      keys = new Set([...(keys ?? []), ...newKeys]);
      persist();
    },
    size: () => (keys ?? new Set()).size,
  };
}

/**
 * Everything on the feed that post-dates the install-day snapshot.
 *
 * ⛔ The FIRST call returns nothing no matter what is on screen, and is the ONLY
 * call that writes. Otherwise installing the claw would cold-DM the entire
 * backlog of everyone who ever liked a post, all at once.
 *
 * ⛔ It deliberately does NOT mark anything seen after that. An earlier version
 * did, and it silently dropped people: anyone we couldn't message this poll —
 * hourly budget spent, outside the sending window, a draft that came back
 * unusable — was marked seen and never surfaced again. Leaving them unmarked
 * turns the feed into a work queue that retries them next poll. Re-messaging is
 * prevented by the LEDGER (keyed by person), not by this store (keyed by event).
 */
export function newSince(notifications, store) {
  if (store.isBaseline()) {
    store.remember(notifications.map(keyOf));
    return [];
  }
  return notifications.filter((n) => !store.has(keyOf(n)));
}
