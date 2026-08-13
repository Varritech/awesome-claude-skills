// Target collection — READ ONLY.
//
// Drives the logged-in session to answer two questions:
//   1. who followed us recently?
//   2. who liked our recent posts?
// and returns one normalized row per PERSON. Someone who did both comes back
// as a liker, because a liker gives the opener something concrete to reference
// ("saw you liked the bit about X") and a bare follow does not.

import { normalizeHandle as normalize } from './handle.js';

export async function collectTargets({
  drive,
  now,
  maxFollowers = 30,
  maxPosts = 3,
  maxLikersPerPost = 30,
}) {
  const merged = new Map();

  const followers = await drive({ op: 'readNewFollowers', max: maxFollowers });
  for (const row of followers) {
    const handle = normalize(row.handle);
    if (!handle) continue;
    merged.set(handle, { handle, source: 'follower', postId: null, caption: null, seenAt: now });
  }

  const posts = await drive({ op: 'readRecentPosts', max: maxPosts });
  for (const post of posts) {
    const likers = await drive({ op: 'readPostLikers', postId: post.postId, max: maxLikersPerPost });
    for (const row of likers) {
      const handle = normalize(row.handle);
      if (!handle) continue;
      // Liker always wins over an existing follower row for the same person.
      merged.set(handle, {
        handle,
        source: 'liker',
        postId: post.postId,
        caption: post.caption ?? null,
        seenAt: now,
      });
    }
  }

  return [...merged.values()];
}
