import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { createSeenStore } from '../src/seen.js';
import { planBatch, recordFollowUpSent } from '../src/pipeline.js';
import { draftFollowUp } from '../src/opener.js';
import { buildLibrary, loadNews, sentValueIds } from '../src/value.js';

const NOW = new Date('2026-10-22T16:00:00Z'); // inside any window
const days = (n) => new Date(NOW.getTime() - n * 864e5).toISOString();
const NEWS = [
  { id: 'news-deepseek', type: 'news', title: 'DeepSeek released V4.1-Flash-1017', url: 'https://example.com/a', date: '2026-10-17', why: 'cheaper fast model for agent calls', tags: ['model', 'cost'], anchors: ['deepseek'] },
  { id: 'news-opencode', type: 'news', title: 'OpenCode 2.0 shipped', url: 'https://example.com/b', date: '2026-10-16', why: 'background agents and an SDK', tags: ['agents', 'code'], anchors: ['opencode'] },
];
const library = buildLibrary({ news: NEWS, now: NOW });

// A model that obeys the item it is handed: names its anchor, one question max.
const obedientLlm = async ({ prompt }) => {
  if (/DeepSeek/.test(prompt)) return 'DeepSeek just put out a faster V4.1 Flash, handy if agent costs are creeping up. Building with agents?';
  if (/OpenCode/.test(prompt)) return 'OpenCode 2.0 landed with background agents and an SDK, might save you a weekend.';
  if (/ROUTER/i.test(prompt)) return 'We built a router that sends each request to the cheapest model that can do the job. Reply and I will set you up with free access.';
  const g = prompt.match(/FREE GUIDE: "([^"]+)"/);
  if (g) return `Our free ${g[1]} guide walks through it step by step, no catch.`;
  return 'The strategy guide walks through discovery step by step if useful.';
};

describe('knock two and later are value touchpoints, never check-ins', () => {
  const T = { handle: 'ana', source: 'liker', followUpNumber: 2, opener: 'what are you building with agents', silentDays: 4 };

  it('sends a draft that carries a value item', async () => {
    const out = await draftFollowUp({ target: T, llm: obedientLlm, library, linksBlocked: true });
    expect(out).toMatch(/DeepSeek|OpenCode|router|guide/i);
  });

  it('skips (empty) when the model only produces a check-in, twice', async () => {
    let calls = 0;
    const out = await draftFollowUp({
      target: T, library, linksBlocked: true, log: () => {},
      llm: async () => { calls += 1; return 'Hope it is going well, wishing you the best with whatever you build!'; },
    });
    expect(out).toBe('');
    expect(calls).toBe(2);
  });

  it('a reopened old thread also gets value, not a bare question', async () => {
    const out = await draftFollowUp({
      target: { handle: 'olddm', followUpNumber: 1, reopen: true, silentDays: 200, opener: undefined },
      library, linksBlocked: true, llm: obedientLlm,
    });
    expect(out).toMatch(/DeepSeek|OpenCode|router|guide/i);
  });

  it('knock one stays Cristiano\'s fixed guide copy', async () => {
    const out = await draftFollowUp({ target: { handle: 'a', followUpNumber: 1, source: 'liker' }, llm: async () => { throw new Error('no'); }, library });
    expect(out).toContain('$149.99');
  });
});

describe('planBatch + ledger: one value item per person, never repeated', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'val-'));
    const ledger = createLedger({ path: join(dir, 'c.json') });
    ledger.record('ana', { at: days(30), text: 'hey, what are you building?', source: 'liker', followUps: [{ at: days(12), text: 'Hey, we typically charge $149.99 for this guide. Here it is: https://varritech-product-playbook.vercel.app/guide-1', valueId: 'guide-1' }] });
    const seen = createSeenStore({ path: join(dir, 's.json') });
    return { dir, ledger, seen };
  };
  const plan = async ({ ledger, seen }, extra = {}) => {
    await planBatch({ notifications: [], seen, ledger, llm: obedientLlm, cap: 2, now: NOW, library, linksBlocked: true, ...extra });
    return planBatch({ notifications: [], seen, ledger, llm: obedientLlm, cap: 2, now: NOW, library, linksBlocked: true, ...extra });
  };

  it('tags each planned follow-up with the value item it carries', async () => {
    const s = setup();
    const res = await plan(s);
    expect(res.followUps).toHaveLength(1);
    expect(res.followUps[0].valueId).toBeTruthy();
  });

  it('does not send the same item again on the next knock', async () => {
    const s = setup();
    const first = (await plan(s)).followUps[0];
    await recordFollowUpSent({ ledger: s.ledger, handle: 'ana', text: first.text, valueId: first.valueId, library });
    // age the knock so the next one is due
    const entries = JSON.parse(JSON.stringify(s.ledger.all()));
    s.ledger.record('ana', { ...entries[0], followUps: entries[0].followUps.map((f) => ({ ...f, at: days(20) })) });
    const second = (await plan(s)).followUps[0];
    expect(second.valueId).toBeTruthy();
    expect(second.valueId).not.toBe(first.valueId);
  });

  it('records the item in the ledger even if the runner forgets to pass the id', async () => {
    const s = setup();
    await recordFollowUpSent({ ledger: s.ledger, handle: 'ana', text: 'DeepSeek just put out a faster V4.1 Flash.', library });
    expect(sentValueIds(s.ledger.all()[0])).toEqual(['guide-1', 'news-deepseek']);
  });

  it('a skipped follow-up (bad drafts) leaves the person unrecorded and due', async () => {
    const s = setup();
    const res = await plan(s, { llm: async () => 'Hope it is going well!', log: () => {} });
    expect(res.followUps).toHaveLength(0);
    expect(s.ledger.all()[0].followUps).toHaveLength(1); // only the seeded guide knock
  });

  it('knock one is tagged with the fixed guide so it is never sent again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'val-'));
    const ledger = createLedger({ path: join(dir, 'c.json') });
    ledger.record('bo', { at: days(5), text: 'hi', source: 'follower' });
    const seen = createSeenStore({ path: join(dir, 's.json') });
    const res = await (async () => {
      await planBatch({ notifications: [], seen, ledger, llm: obedientLlm, cap: 2, now: NOW, library });
      return planBatch({ notifications: [], seen, ledger, llm: obedientLlm, cap: 2, now: NOW, library });
    })();
    expect(res.followUps[0].valueId).toBe('guide-1');
  });
});

describe('the news store file', () => {
  it('loads items from state/value-library.json and tolerates a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'val-'));
    expect(loadNews(join(dir, 'nope.json'))).toEqual([]);
    writeFileSync(join(dir, 'v.json'), JSON.stringify({ news: NEWS }));
    expect(loadNews(join(dir, 'v.json'))).toHaveLength(2);
  });
});
