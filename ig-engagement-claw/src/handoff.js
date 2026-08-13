// Handoff into the sales claw.
//
// The Cloud Run claw (~/instagram-claw) derives conversation stage from
// `ig_threads/{IGSID}` -> { turns: [{role:"them"|"us", text}] }. If our
// browser-sent opener isn't in there, the webhook fires on the reply, the
// drafter sees message #1 with no history, and re-introduces the founder to
// someone we already opened — the exact stateless bug fixed in July, walked
// back in through a different door.
//
// The catch: that store is keyed by IGSID, and the browser only ever sees a
// @handle. When we can resolve the IGSID we write the real thread doc. When we
// can't, we park the opener in `ig_pending_openers/{handle}` rather than
// writing a doc under a key nothing will ever look up.

import { normalizeHandle } from './handle.js';

export const THREADS = 'ig_threads';
export const PENDING = 'ig_pending_openers';

export async function recordOpener({ store, target, text, now = new Date().toISOString() }) {
  const handle = normalizeHandle(target.handle);
  if (target.igUserId) {
    const key = String(target.igUserId);
    const doc = (await store.get(THREADS, key)) ?? { turns: [] };
    doc.turns.push({ role: 'us', text });
    await store.set(THREADS, key, doc);
    return { collection: THREADS, key };
  }

  await store.set(PENDING, handle, { handle, text, openedAt: now });
  return { collection: PENDING, key: handle };
}
