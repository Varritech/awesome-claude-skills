import { describe, it, expect } from 'vitest';
import { parseNotifications } from '../src/notifications.js';

// Verbatim rows pulled off the live @varritech notifications feed 2026-08-14.
const LIVE = [
  { handle: 'ajinlamusic', text: 'ajinlamusic started following you. 57m Follow Back', postHref: null },
  { handle: 'kndall', text: 'kndall liked your photo. 2h', postHref: '/p/DbuZqV0AZ0v/' },
];

describe('parseNotifications', () => {
  it('reads a follow and a like off the real feed', () => {
    expect(parseNotifications(LIVE)).toEqual([
      { handle: 'ajinlamusic', source: 'follower', postId: null, ageText: '57m' },
      { handle: 'kndall', source: 'liker', postId: 'DbuZqV0AZ0v', ageText: '2h' },
    ]);
  });
});
