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
//   "afshin.m.2019 commented: Build 3h"
//   "jwat_5 commented: Boooo AI you suck booooo 2d"
// The trailing word ("Follow Back" / "Requested" / "Following") is the button
// state, not part of the event.

import { normalizeHandle } from './handle.js';

const FOLLOW_RE = /started following you/i;
const LIKE_RE = /liked your (?:photo|post|reel|video|story)/i;
const COMMENT_RE = /\bcommented:\s*/i;
// "toto_fan_99 replied to your comment on varritech 's post: @varritech ..."
const REPLY_RE = /\breplied to your comment on .*?'s post:\s*/i;
const AGE_RE = /\b(\d+[smhdw])\b/;

// Instagram appends the age to the row text with no separator, so the comment
// body runs straight into it: "commented: Build 3h". Relative for the first
// week ("3h", "2d"), an absolute date after that ("Aug 09").
const TRAILING_AGE_RE = /\s+(?:\d+[smhdw]|[A-Z][a-z]{2}\s+\d{1,2})$/;

// A long comment is elided in the feed as "... more" before the age. What we get
// is a PREFIX of what they wrote, so the body is flagged truncated and must never
// be quoted back as if it were the whole sentence.
const MORE_RE = /\s*\.\.\.\s*more$/i;

// A reply carries the @mention Instagram itself inserted, not something they typed.
const LEADING_MENTION_RE = /^@[\w.]+\s+/;

/**
 * The words they actually typed, with Instagram's own furniture removed:
 * the trailing timestamp, the "... more" elision, and the auto-@mention.
 */
function commentBodyFrom(text, splitter) {
  const after = text.slice(text.search(splitter)).replace(splitter, '');
  const withoutAge = after.replace(TRAILING_AGE_RE, '');
  const truncated = MORE_RE.test(withoutAge);
  const body = withoutAge.replace(MORE_RE, '').replace(LEADING_MENTION_RE, '').trim();
  return { body, truncated };
}

const postIdFrom = (href) => {
  const m = /\/(?:p|reel)\/([^/]+)/.exec(href ?? '');
  return m ? m[1] : null;
};

function commentFields(text, splitter) {
  const { body, truncated } = commentBodyFrom(text, splitter);
  return { commentText: body, ...(truncated ? { truncated: true } : {}) };
}

export function parseNotifications(rows) {
  const out = [];
  for (const row of rows ?? []) {
    const text = String(row.text ?? '');
    const isFollow = FOLLOW_RE.test(text);
    const isReply = REPLY_RE.test(text);
    const isComment = isReply || COMMENT_RE.test(text);
    const isLike = !isComment && LIKE_RE.test(text);
    if (!isFollow && !isLike && !isComment) continue;

    const handle = normalizeHandle(row.handle);
    if (!handle) continue;

    const source = isComment ? 'commenter' : isFollow ? 'follower' : 'liker';
    out.push({
      handle,
      source,
      postId: isFollow ? null : postIdFrom(row.postHref),
      ageText: (AGE_RE.exec(text) ?? [])[1] ?? null,
      ...(isComment ? commentFields(text, isReply ? REPLY_RE : COMMENT_RE) : {}),
    });
  }
  return out;
}
