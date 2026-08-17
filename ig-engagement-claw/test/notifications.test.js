import { describe, it, expect } from 'vitest';
import { parseNotifications } from '../src/notifications.js';

// Verbatim rows pulled off the live @varritech notifications feed 2026-08-14.
const LIVE = [
  { handle: 'ajinlamusic', text: 'ajinlamusic started following you. 57m Follow Back', postHref: null },
  { handle: 'kndall', text: 'kndall liked your photo. 2h', postHref: '/p/DbuZqV0AZ0v/' },
];

// Comment rows, verbatim off the same feed 2026-08-17. A comment is the strongest
// signal on the feed — they typed words at us — and it is the ONLY source that
// carries something to quote back.
const COMMENTS = [
  { handle: 'afshin.m.2019', text: 'afshin.m.2019 commented: Build 3h', postHref: '/p/Da1rOHhAIOD/' },
  { handle: 'jwat_5', text: 'jwat_5 commented: Boooo AI you suck booooo 2d', postHref: '/p/DcAk1_6gzFD/' },
];

describe('parseNotifications', () => {
  it('reads a follow and a like off the real feed', () => {
    expect(parseNotifications(LIVE)).toEqual([
      { handle: 'ajinlamusic', source: 'follower', postId: null, ageText: '57m' },
      { handle: 'kndall', source: 'liker', postId: 'DbuZqV0AZ0v', ageText: '2h' },
    ]);
  });

  it('reads a comment and keeps the words they actually typed', () => {
    expect(parseNotifications(COMMENTS)).toEqual([
      {
        handle: 'afshin.m.2019',
        source: 'commenter',
        postId: 'Da1rOHhAIOD',
        ageText: '3h',
        commentText: 'Build',
      },
      {
        handle: 'jwat_5',
        source: 'commenter',
        postId: 'DcAk1_6gzFD',
        ageText: '2d',
        commentText: 'Boooo AI you suck booooo',
      },
    ]);
  });
  it('reads a reply to our own comment, and never keeps Instagram\'s "... more" truncation marker', () => {
    // Verbatim, 2026-08-17. Instagram elides a long comment in the feed with a
    // literal " ... more" before the age — quoting that back would be gibberish.
    const rows = [
      {
        handle: 'toto_fan_99',
        text:
          "toto_fan_99 replied to your comment on varritech 's post: @varritech by using ai you are " +
          'exploiting the work of many people whose work was used without credit or compen ... more 19h',
        postHref: '/p/Da1rOHhAIOD/',
      },
    ];
    expect(parseNotifications(rows)).toEqual([
      {
        handle: 'toto_fan_99',
        source: 'commenter',
        postId: 'Da1rOHhAIOD',
        ageText: '19h',
        commentText:
          'by using ai you are exploiting the work of many people whose work was used without credit or compen',
        truncated: true,
      },
    ]);
  });
});
