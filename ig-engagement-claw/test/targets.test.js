import { describe, it, expect } from 'vitest';
import { collectTargets } from '../src/targets.js';

// `drive` is the injected browser seam: one op in, extracted rows out.
const fakeDrive = (rows) => async (step) => rows[step.op] ?? [];

describe('collectTargets', () => {
  it('merges followers and likers, keeping one entry per person', async () => {
    const drive = fakeDrive({
      readNewFollowers: [{ handle: '@Ana' }, { handle: '@bob' }],
      readRecentPosts: [{ postId: 'P1', caption: 'shipping fast' }],
      readPostLikers: [{ handle: 'ana' }, { handle: '@carl' }],
    });

    const targets = await collectTargets({ drive, now: '2026-08-13T10:00:00.000Z' });
    const byHandle = Object.fromEntries(targets.map((t) => [t.handle, t]));

    expect(Object.keys(byHandle).sort()).toEqual(['ana', 'bob', 'carl']);
    // Ana did both -> she is a liker, because that is what the opener can reference.
    expect(byHandle.ana.source).toBe('liker');
    expect(byHandle.ana.postId).toBe('P1');
    expect(byHandle.bob.source).toBe('follower');
  });
});
