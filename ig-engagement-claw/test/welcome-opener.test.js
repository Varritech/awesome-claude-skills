import { describe, it, expect } from 'vitest';
import { draftOpener } from '../src/opener.js';

// Cristiano, 2026-10-22: the opener offers the free Scalewright guide plus free
// help (AI automation, AI marketing, design, a website review), in his words.
// The reply claw (~/instagram-claw) delivers each of those for real.
const neverCalled = async () => {
  throw new Error('the welcome opener is fixed copy, the model must not be asked');
};

describe('welcome opener', () => {
  const FOLLOWER = { handle: 'ana', source: 'follower' };

  it('offers the free Scalewright guide on the back of the $10k MRR guarantee', async () => {
    const text = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(text).toMatch(/Scalewright/);
    expect(text).toContain('$10k MRR');
    expect(text).toMatch(/free guide/i);
    expect(text).toMatch(/would you be interested\?/i);
  });

  it('offers the free help too: AI automation, AI marketing, design, a website review', async () => {
    const text = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(text).toMatch(/automating your business with AI/i);
    expect(text).toMatch(/AI marketing/i);
    expect(text).toMatch(/design/i);
    expect(text).toMatch(/look at your website/i);
    expect(text).toMatch(/all for free/i);
  });

  it('asks exactly one question and never "what are you working on"', async () => {
    const text = await draftOpener({ target: FOLLOWER, llm: neverCalled });
    expect(text.split('?').length - 1).toBe(1);
    expect(text).not.toMatch(/what are you (working on|building)/i);
  });

  it('carries no link and no em dash, for every source', async () => {
    for (const source of ['follower', 'liker', 'commenter']) {
      const text = await draftOpener({ target: { handle: 'x', source }, llm: neverCalled });
      expect(text).not.toMatch(/https?:\/\/|www\.|\.com\b/);
      expect(text).not.toMatch(/[—–]/);
    }
  });
});
