import { describe, it, expect } from 'vitest';
import { draftOpener, buildPrompt } from '../src/opener.js';

const llmSaying = (text) => async () => text;
const LIKER = { handle: 'ana', source: 'liker', postId: 'P1', caption: 'how we cut render time' };

describe('draftOpener', () => {
  it('strips a link even when the model insists on one', async () => {
    const text = await draftOpener({
      target: LIKER,
      llm: llmSaying('Saw you liked the render post. Grab the breakdown at https://varritech.com/x'),
    });
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/varritech\.com/);
    expect(text.length).toBeGreaterThan(0);
  });

  it('caps a rambling draft at whole sentences, never mid-word', async () => {
    const rambly =
      'Hey there I saw you liked our post. ' +
      'We help founders ship faster and we do a lot of things across many stacks. ' +
      'We have worked with dozens of teams on all sorts of builds over the years. ' +
      'What are you building right now?';
    const text = await draftOpener({ target: LIKER, llm: llmSaying(rambly) });

    expect(text.split(/\s+/).length).toBeLessThanOrEqual(35);
    expect(text).toMatch(/[.!?]$/);         // landed on a sentence end
    expect(rambly).toContain(text.trim());  // no invented or truncated words
  });

  it('refuses an opener containing an unfilled template placeholder', async () => {
    // Seen live: "noticed you're into [space/niche]" — the model leaving a slot
    // for itself. Sending that verbatim is worse than sending nothing.
    const text = await draftOpener({
      target: LIKER,
      llm: llmSaying("Hey! Noticed you're into [space/niche]. What are you building?"),
    });
    expect(text).toBe('');
  });

  it('keeps a normal opener that merely uses brackets in passing', async () => {
    const text = await draftOpener({ target: LIKER, llm: llmSaying('Saw your post. What are you building?') });
    expect(text).not.toBe('');
  });
});

describe('buildPrompt', () => {
  it('hands the model the exact words a commenter typed', () => {
    const prompt = buildPrompt({
      handle: 'afshin.m.2019',
      source: 'commenter',
      postId: 'Da1rOHhAIOD',
      commentText: 'Build',
    });
    expect(prompt).toContain('"Build"');
    expect(prompt).toContain('commented');
  });

  it('tells the model a truncated comment is only a fragment, so it never quotes it back whole', () => {
    const prompt = buildPrompt({
      handle: 'toto_fan_99',
      source: 'commenter',
      postId: 'Da1rOHhAIOD',
      commentText: 'by using ai you are exploiting the work of many people whose work was used without compen',
      truncated: true,
    });
    expect(prompt).toMatch(/cut off|partial|fragment/i);
    expect(prompt).toMatch(/do not quote/i);
  });
});
