import { describe, it, expect } from 'vitest';
import { draftOpener, buildPrompt, buildFollowUpPrompt, draftFollowUp } from '../src/opener.js';

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

describe('buildPrompt — no invented facts', () => {
  it('forbids describing the post when we do not know its caption', () => {
    // Live 2026-08-17: with no caption the model wrote "the post about scaling
    // with automation" — a topic it made up about OUR OWN post. A first DM that
    // misdescribes our content is worse than a generic one.
    const prompt = buildPrompt({ handle: 'floresaireona', source: 'liker', postId: 'DcIWNq_gXu9' });
    expect(prompt).toMatch(/do not (?:describe|say|guess) what/i);
  });

  it('still lets it name the topic when the caption is actually known', () => {
    const prompt = buildPrompt({
      handle: 'ana', source: 'liker', postId: 'P1', caption: 'how we cut render time',
    });
    expect(prompt).toContain('"how we cut render time"');
    expect(prompt).not.toMatch(/do not (?:describe|say|guess) what/i);
  });
});

describe('never ships an em dash', () => {
  it('rewrites an em dash the model insisted on, rather than sending it', async () => {
    // Cristiano's standing rule: never an em dash, anywhere, in anything that
    // goes out under his name. The live model produced one on 3 of 4 first
    // drafts, so this is enforced in code like the link strip, not in the prompt.
    const text = await draftOpener({
      target: LIKER,
      llm: llmSaying('Hey! Saw you drop "Build" on our post \u2014 love that energy. What are you building?'),
    });
    expect(text).not.toMatch(/[\u2014\u2013]/);
    expect(text).toContain('love that energy');
  });
});

describe('follow-up drafting', () => {
  const TARGET = { handle: 'ana', source: 'liker', followUpNumber: 1, opener: 'Saw you liked the post. What are you building?', silentDays: 4 };

  it('tells the model what we already said, so the follow-up is not a copy of the opener', () => {
    const prompt = buildFollowUpPrompt(TARGET);
    expect(prompt).toContain('Saw you liked the post. What are you building?');
    expect(prompt).toMatch(/do not repeat|already sent|different/i);
  });

  it('never guilt-trips them for not replying', () => {
    // "just following up" / "did you see my message" is the tell of a bot and
    // the fastest way to get reported. It has to add something or say nothing.
    expect(buildFollowUpPrompt(TARGET)).toMatch(/never (?:guilt|shame|nag)|do not.*chase/i);
  });

  it('says plainly that this is the last message on the second knock', () => {
    const prompt = buildFollowUpPrompt({ ...TARGET, followUpNumber: 2 });
    expect(prompt).toMatch(/last|final/i);
  });

  it('runs a follow-up through the same link, em dash and placeholder guards as an opener', async () => {
    const text = await draftFollowUp({
      target: TARGET,
      llm: async () => 'Still building? Grab it at https://varritech.com/x \u2014 [niche] founders love it',
    });
    // Placeholder means drop entirely, same as an opener.
    expect(text).toBe('');
  });

  it('keeps a clean follow-up, stripped of links and em dashes', async () => {
    const text = await draftFollowUp({
      target: TARGET,
      llm: async () => 'No worries if the timing is off \u2014 what are you working on this week?',
    });
    expect(text).not.toMatch(/[\u2014\u2013]/);
    expect(text).toContain('what are you working on this week');
  });
});

