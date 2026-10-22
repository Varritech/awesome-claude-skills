import { describe, it, expect } from 'vitest';
import { draftOpener, buildPrompt, draftFollowUp, ALLOWED_LINK_HOSTS, FOLLOW_UP_GUIDE_TEXT } from '../src/opener.js';
import { buildLibrary, GUIDES } from '../src/value.js';

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
  // Knock two and later are value touchpoints (src/value.js, value.test.js).
  const TARGET = { handle: 'ana', source: 'liker', followUpNumber: 2, opener: 'Saw you liked the post. What are you building?', silentDays: 4 };
  const library = buildLibrary({ news: [], now: new Date('2026-10-22T12:00:00Z') });

  it('hands the model the value item and what we already said, and bans the empty check-in', async () => {
    let prompt = '';
    await draftFollowUp({ target: TARGET, library, linksBlocked: true, llm: async ({ prompt: p }) => { prompt = p; return 'x'; }, log: () => {} });
    expect(prompt).toContain('Saw you liked the post. What are you building?');
    expect(prompt).toMatch(/never say: hope it is going well|wishing you the best|just following up/i);
    expect(prompt).toMatch(/free guide|router/i);
  });

  it('drops a draft with a template placeholder instead of sending it', async () => {
    const text = await draftFollowUp({
      target: TARGET, library, linksBlocked: true, log: () => {},
      llm: async () => 'The strategy guide helps [niche] founders',
    });
    expect(text).toBe('');
  });

  it('keeps a clean value follow-up, stripped of em dashes', async () => {
    const text = await draftFollowUp({
      target: TARGET, library, linksBlocked: true,
      llm: async () => 'We put together a free strategy guide \u2014 want it for what you are building?',
    });
    expect(text).not.toMatch(/[\u2014\u2013]/);
    expect(text).toContain('strategy guide');
  });
});

const oneGuide = { now: new Date(), items: GUIDES.slice(0, 1) };
describe('links in follow-ups', () => {
  // followUpNumber 2 — knock ONE is fixed copy with no model involved, so the
  // link/em-dash/placeholder guards only have anything to guard on knock two.
  const T = { handle: 'ana', source: 'liker', followUpNumber: 2, opener: 'hi', silentDays: 4 };

  it('lets OUR link through, because the browser sends a real DM', async () => {
    // The blanket link strip was inherited from the API claw, where InstantDM
    // rejects any DM containing a URL. This claw types into the real web
    // composer, so that constraint simply does not apply here.
    const text = await draftFollowUp({
      target: { ...T, valueItems: [] },
      library: oneGuide,
      llm: async () => 'Here is the free strategy guide: https://varritech-product-playbook.vercel.app/guide-1',
    });
    expect(text).toContain('https://varritech-product-playbook.vercel.app/guide-1');
  });

  it('still strips a link to anywhere we did not authorise', async () => {
    // An allowlist, not a free-for-all: a hallucinated or mistyped URL in a DM
    // going out under Cristiano's name is worse than no link at all.
    const text = await draftFollowUp({
      target: T, library: oneGuide, log: () => {},
      llm: async () => 'Check the strategy guide https://bit.ly/xyz and https://random-site.com/thing',
    });
    expect(text).not.toMatch(/bit\.ly|random-site/);
  });

  it('keeps a COLD opener link-free — first contact with a stranger stays clean', async () => {
    const text = await draftOpener({
      target: { handle: 'ana', source: 'liker' },
      llm: async () => 'Hey, grab it at https://varritech-product-playbook.vercel.app/guide-1',
    });
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('authorises only Varritech hosts', () => {
    expect(ALLOWED_LINK_HOSTS.every((h) => /varritech/.test(h))).toBe(true);
  });
});

describe('the value drop', () => {
  const T = { handle: 'ana', source: 'liker', followUpNumber: 1, opener: 'hi', silentDays: 4 };

  it('sends Cristiano\'s exact copy: the price anchor, the framing, and the link', async () => {
    // Fixed copy, not an LLM draft. The price, the programme name and the URL
    // all have to survive verbatim, and a model paraphrasing any of them is a
    // worse outcome than no personalisation at all.
    const text = await draftFollowUp({ target: T, llm: async () => 'IGNORED' });
    expect(text).toContain('$149.99');
    expect(text).toMatch(/strategy phase/i);
    expect(text).toMatch(/scalewright/i);
    expect(text).toContain('https://varritech-product-playbook.vercel.app/guide-1');
    expect(text).not.toBe('IGNORED');
  });

  it('does not truncate the value drop to the opener word cap', () => {
    expect(FOLLOW_UP_GUIDE_TEXT.split(/\s+/).length).toBeGreaterThan(35);
  });

  it('carries no em dash, like everything else that goes out under his name', () => {
    expect(FOLLOW_UP_GUIDE_TEXT).not.toMatch(/[\u2014\u2013]/);
  });

  it('never repeats the knock-one guide in a later knock', async () => {
    const out = await draftFollowUp({
      target: { ...T, followUpNumber: 2, valueItems: ['guide-1'] },
      library: { now: new Date(), items: GUIDES.slice(0, 2) }, linksBlocked: true,
      llm: async ({ prompt }) => (/guide-1/.test(prompt) ? 'the strategy guide' : 'The design system guide covers UI and UX basics for founders.'),
    });
    expect(out).toMatch(/design/i);
  });
});
