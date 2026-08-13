import { describe, it, expect } from 'vitest';
import { draftOpener } from '../src/opener.js';

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
});
