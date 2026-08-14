// The notifications feed IS the "who is new" list.
//
// Scraping the followers list can't tell a follower from 2024 apart from one
// from 2 minutes ago, and it means scrolling 674 virtualized rows every poll.
// The notifications feed already says who did what and how long ago, newest
// first — so the claw watches that and diffs it against what it saw last time.
//
// Row text shapes, verbatim from the live @varritech feed (2026-08-14):
//   "ajinlamusic started following you. 57m Follow Back"
//   "kndall liked your photo. 2h"
//   "nourishbiomeai liked your reel. 13h"
//   "saves.tax and awol_25 liked your photo. 21h"
//   "notrealmuddyy , bernacikpascal and 76 others liked your post. 6h"
// The trailing word ("Follow Back" / "Requested" / "Following") is the button
// state, not part of the event.

import { normalizeHandle } from './handle.js';

const FOLLOW_RE = /started following you/i;
const LIKE_RE = /liked your (?:photo|post|reel|video|story)/i;
const AGE_RE = /\b(\d+[smhdw])\b/;

const postIdFrom = (href) => {
  const m = /\/(?:p|reel)\/([^/]+)/.exec(href ?? '');
  return m ? m[1] : null;
};

export function parseNotifications(rows) {
  const out = [];
  for (const row of rows ?? []) {
    const text = String(row.text ?? '');
    const isFollow = FOLLOW_RE.test(text);
    const isLike = LIKE_RE.test(text);
    if (!isFollow && !isLike) continue;

    const handle = normalizeHandle(row.handle);
    if (!handle) continue;

    out.push({
      handle,
      source: isFollow ? 'follower' : 'liker',
      postId: isFollow ? null : postIdFrom(row.postHref),
      ageText: (AGE_RE.exec(text) ?? [])[1] ?? null,
    });
  }
  return out;
}
