import { describe, it, expect } from 'vitest';
import { draftOpener } from '../src/opener.js';

// Cristiano, 2026-10-22: the old opener ("Thanks for following. What are you
// working on right now?") gave nothing. The first DM now hands over something
// useful straight away and asks for their email so the full guide can follow.
const neverCalled = async () => {
  throw new Error('the welcome opener is fixed copy, the model must not be asked');
};

describe('welcome opener', () => {
  const FOLLOWER = { handle: 'ana', source: 'follower' };

  it('gives a concrete result up front and asks for their email', async () => {
    const text = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(text).toContain('$3.08');
    expect(text).toMatch(/email/i);
    expect(text).not.toMatch(/what are you (working on|building)/i);
  });

  it('asks for exactly one thing', async () => {
    const text = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(text.split('?').length - 1).toBeLessThanOrEqual(1);
  });

  it('thanks them for what they actually did', async () => {
    expect(await draftOpener({ target: FOLLOWER, llm: neverCalled })).toMatch(/thanks for the follow/i);
    expect(await draftOpener({ target: { handle: 'b', source: 'liker' }, llm: neverCalled })).toMatch(/thanks for the like/i);
    expect(await draftOpener({ target: { handle: 'c', source: 'commenter', commentText: 'Build' }, llm: neverCalled })).toMatch(/thanks for the comment/i);
  });

  it('carries no link and no em dash', async () => {
    for (const handle of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const text = await draftOpener({ target: { handle, source: 'follower' }, llm: neverCalled });
      expect(text).not.toMatch(/https?:\/\/|www\.|\.com\b/);
      expect(text).not.toMatch(/[—–]/);
    }
  });

  it('rotates the wording across people but is stable for one person', async () => {
    const texts = new Set();
    for (const handle of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', 'j10']) {
      texts.add(await draftOpener({ target: { handle, source: 'follower' }, llm: neverCalled }));
    }
    expect(texts.size).toBeGreaterThan(1);
    const once = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    const twice = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(once).toBe(twice);
  });
});
