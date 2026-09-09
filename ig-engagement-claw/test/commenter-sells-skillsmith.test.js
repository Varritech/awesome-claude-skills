import { describe, it, expect } from 'vitest';
import { followUpGuideText, GUIDE_URL } from '../src/opener.js';
import { draftFollowUp } from '../src/opener.js';

/**
 * 2026-09-09, Cristiano: "if it commented it should gear towards selling them
 * the skillssmith."
 *
 * A commenter told us what they care about in their own words, which makes them
 * the warmest source and the one worth pointing at the product rather than the
 * strategy guide.
 *
 * ⛔ The $149.99 guide anchor and the Scalewright wording stay EXACTLY as they
 * are for followers and likers — queried and overridden once already
 * ([[feedback_guide_price_anchor_is_deliberate]]). This adds a commenter
 * variant, it does not correct the existing one.
 */
describe('knock one, for a commenter, sells the Skills Library', () => {
  it('carries the live Skillsmith offer, not the $149.99 guide', () => {
    const t = followUpGuideText({ source: 'commenter' });
    expect(t).toMatch(/268/);
    expect(t).toMatch(/\$47/);
    expect(t).toMatch(/\$197/);
    expect(t).toMatch(/one time|one-time/i);
    expect(t).not.toMatch(/\$149\.99/);
  });

  it("uses the founder's own proof and mechanism", () => {
    const t = followUpGuideText({ source: 'commenter' });
    expect(t).toMatch(/seven-figure agency/i);
    expect(t).toMatch(/departments/i);
  });

  it('sends the library link when links are allowed', () => {
    const t = followUpGuideText({ source: 'commenter', linksBlocked: false });
    expect(t).toContain('https://www.varritech.com/products/claude-skills-library-pro');
  });

  it('⛔ never leaves a dangling "here it is" when links are blocked', () => {
    const t = followUpGuideText({ source: 'commenter', linksBlocked: true });
    expect(t).not.toMatch(/https?:\/\//);
    expect(t).not.toMatch(/here it is:?\s*$/i);
    expect(t).toMatch(/reply/i);
  });
});

describe('followers and likers are untouched', () => {
  for (const source of ['follower', 'liker', null, undefined]) {
    it(`still sends the $149.99 guide for ${source}`, () => {
      const t = followUpGuideText({ source });
      expect(t).toMatch(/\$149\.99/);
      expect(t).toMatch(/Scalewright/);
      expect(t).toContain(GUIDE_URL);
      expect(t).not.toMatch(/268/);
    });
  }
});

describe('the drafter routes knock one by source', () => {
  it('gives a commenter the Skillsmith pitch without calling the model', async () => {
    let called = false;
    const llm = async () => { called = true; return 'should not be used'; };
    const out = await draftFollowUp({
      target: { handle: 'x', followUpNumber: 1, source: 'commenter' },
      llm,
    });
    expect(called).toBe(false); // fixed copy, verbatim values must survive
    expect(out).toMatch(/268/);
  });

  it('gives a follower the guide', async () => {
    const out = await draftFollowUp({
      target: { handle: 'y', followUpNumber: 1, source: 'follower' },
      llm: async () => 'unused',
    });
    expect(out).toMatch(/\$149\.99/);
  });
});

/**
 * ⛔ THE WIRING, which is where this actually broke.
 *
 * The commenter branch above is worthless unless `source` survives from the
 * notification row, through commitSend into the ledger, and back out of
 * dueForFollowUp days later. Both ends were broken: the CLI's `commit` never
 * passed source (every ledger row reads source:null), and dueForFollowUp did
 * not carry it into the follow-up target.
 */
describe('source survives from the notification row to knock one', () => {
  it('dueForFollowUp carries source through to the follow-up target', async () => {
    const { dueForFollowUp } = await import('../src/followups.js');
    const past = new Date('2026-09-01T00:00:00.000Z').toISOString();
    const ledger = {
      all: () => [{ handle: 'a', at: past, text: 'hi', source: 'commenter' }],
    };
    const due = dueForFollowUp({ ledger, now: new Date('2026-09-09T00:00:00.000Z'), cadenceDays: [3, 7] });
    expect(due).toHaveLength(1);
    expect(due[0].source).toBe('commenter');
  });

  it('a commenter due for knock one actually gets the Skillsmith copy', async () => {
    const { dueForFollowUp } = await import('../src/followups.js');
    const past = new Date('2026-09-01T00:00:00.000Z').toISOString();
    const ledger = { all: () => [{ handle: 'a', at: past, text: 'hi', source: 'commenter' }] };
    const [target] = dueForFollowUp({ ledger, now: new Date('2026-09-09T00:00:00.000Z'), cadenceDays: [3, 7] });
    const out = await draftFollowUp({ target, llm: async () => 'unused' });
    expect(out).toMatch(/268/);
    expect(out).not.toMatch(/\$149\.99/);
  });
});
