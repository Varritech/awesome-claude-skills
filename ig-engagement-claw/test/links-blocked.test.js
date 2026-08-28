import { describe, it, expect } from 'vitest';
import { followUpGuideText, draftFollowUp, GUIDE_URL } from '../src/opener.js';

// @varritech is under an Instagram "you can't share links" restriction
// (added 2026-08-28, ends 2026-09-27). DMs are NOT blocked — only URLs are.
// Knock one is the only claw message that carries a link, so it is the only
// one that has to change while the restriction is live.
describe('followUpGuideText under a link-sharing restriction', () => {
  it('ships the URL normally', () => {
    const t = followUpGuideText({ linksBlocked: false });
    expect(t).toContain(GUIDE_URL);
    expect(t).toContain('$149.99');
  });

  it('drops the URL but keeps the price anchor and the programme name', () => {
    const t = followUpGuideText({ linksBlocked: true });
    expect(t).not.toMatch(/https?:\/\//);
    expect(t).not.toContain(GUIDE_URL);
    expect(t).toContain('$149.99');
    expect(t).toContain('Scalewright');
  });

  it('asks them to reply, so the guide still has a route to them', () => {
    expect(followUpGuideText({ linksBlocked: true }).toLowerCase()).toContain('reply');
  });
});

describe('draftFollowUp knock 1 honours linksBlocked', () => {
  const never = async () => { throw new Error('knock 1 must never call the model'); };

  it('returns link-free copy when links are blocked', async () => {
    const t = await draftFollowUp({ target: { followUpNumber: 1 }, llm: never, linksBlocked: true });
    expect(t).not.toMatch(/https?:\/\//);
    expect(t).toContain('$149.99');
  });

  it('still strips a model-invented link from knock 2 when links are blocked', async () => {
    const t = await draftFollowUp({
      target: { followUpNumber: 2, opener: 'x' },
      llm: async () => `Good luck! ${GUIDE_URL}`,
      linksBlocked: true,
    });
    expect(t).not.toMatch(/https?:\/\//);
  });
});
