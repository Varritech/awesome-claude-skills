import { describe, it, expect } from 'vitest';
import { draftOpener, draftFollowUp, ALLOWED_LINK_HOSTS, FOLLOW_UP_GUIDE_TEXT } from '../src/opener.js';
import { buildLibrary, GUIDES } from '../src/value.js';


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
      target: TARGET, library: { now: new Date(), items: GUIDES.slice(0, 1) }, linksBlocked: true,
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
      library: { now: new Date(), items: [GUIDES[0], GUIDES[2]] }, linksBlocked: true,
      llm: async ({ prompt }) => (/guide-1/.test(prompt) ? 'the strategy guide' : 'The Full-Stack Engineering guide covers the stack decisions for founders.'),
    });
    expect(out).toMatch(/engineering/i);
  });
});
