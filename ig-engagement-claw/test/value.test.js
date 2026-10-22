import { describe, it, expect } from 'vitest';
import {
  GUIDES, ROUTER_OFFER, BANNED_PHRASES, isValidNewsItem, pruneNews, buildLibrary, pickValueItem,
  checkValueDraft, draftValueFollowUp, inferValueId, NEWS_MAX_AGE_DAYS,
} from '../src/value.js';

const NOW = new Date('2026-10-22T12:00:00Z');
const news = (over = {}) => ({
  id: 'news-deepseek-v4-1-flash-1017',
  type: 'news',
  title: 'DeepSeek released V4.1-Flash-1017',
  url: 'https://finance.yahoo.com/technology/ai/articles/deepseek-pushes-updated-ai-model-134714989.html',
  date: '2026-10-17',
  why: 'a cheaper fast model to try for high-volume agent calls',
  tags: ['model', 'cost', 'agents'],
  anchors: ['deepseek'],
  ...over,
});
const lib = (items = [news()]) => buildLibrary({ news: items, now: NOW });
const target = (over = {}) => ({ handle: 'ana', followUpNumber: 2, opener: 'Curious what you are building with agents', source: 'liker', ...over });

describe('news items', () => {
  it('needs a source url, a date and a why line, else it is dropped', () => {
    expect(isValidNewsItem(news())).toBe(true);
    expect(isValidNewsItem(news({ url: '' }))).toBe(false);
    expect(isValidNewsItem(news({ url: 'not a url' }))).toBe(false);
    expect(isValidNewsItem(news({ date: 'yesterday' }))).toBe(false);
    expect(isValidNewsItem(news({ why: '' }))).toBe(false);
    expect(isValidNewsItem(news({ title: '' }))).toBe(false);
  });

  it('expires items older than the max age and keeps the boundary day', () => {
    const fresh = news({ id: 'a', date: '2026-10-08' }); // exactly 14 days
    const old = news({ id: 'b', date: '2026-10-07' }); // 15 days
    const future = news({ id: 'c', date: '2026-12-01' }); // a bad date must not live forever
    expect(NEWS_MAX_AGE_DAYS).toBe(14);
    const kept = pruneNews([fresh, old, future], NOW).map((n) => n.id);
    expect(kept).toEqual(['a']);
  });

  it('buildLibrary prunes expired and invalid news but always carries guides and the router offer', () => {
    const l = buildLibrary({ news: [news(), news({ id: 'x', url: '' }), news({ id: 'y', date: '2026-09-01' })], now: NOW });
    expect(l.items.filter((i) => i.type === 'news').map((i) => i.id)).toEqual(['news-deepseek-v4-1-flash-1017']);
    expect(l.items.filter((i) => i.type === 'guide')).toHaveLength(GUIDES.length);
    expect(l.items.some((i) => i.type === 'router')).toBe(true);
  });
});

describe('the router offer', () => {
  it('has no signup link: free access is by reply, because the live router needs a card', () => {
    expect(ROUTER_OFFER.url).toBeUndefined();
    expect(ROUTER_OFFER.why).toMatch(/reply/i);
  });
});

describe('pickValueItem', () => {
  it('never repeats an item already sent to this person', () => {
    const l = lib();
    const first = pickValueItem({ target: target(), library: l, sentIds: [] });
    const second = pickValueItem({ target: target(), library: l, sentIds: [first.id] });
    expect(second.id).not.toBe(first.id);
  });

  it('matches on what we know about them', () => {
    const l = lib([news({ id: 'n-sec', title: 'Security thing', tags: ['security'], anchors: ['security'] }), news()]);
    const pick = pickValueItem({ target: target({ opener: 'building a security tool for banks', followUpNumber: 2 }), library: l, sentIds: [] });
    expect(pick.id).toBe('n-sec');
  });

  it('returns null when everything has already gone to them', () => {
    const l = lib();
    expect(pickValueItem({ target: target(), library: l, sentIds: l.items.map((i) => i.id) })).toBeNull();
  });
});

describe('checkValueDraft', () => {
  const item = news();
  it('accepts a short human message that carries the item', () => {
    expect(checkValueDraft('DeepSeek just dropped a faster V4.1 Flash, worth a look if agent costs bite. Are you running any agents yet?', item).ok).toBe(true);
  });

  it.each(BANNED_PHRASES.map((p) => [String(p), p]))('rejects empty check-in phrase %s', (_n) => {
    expect(checkValueDraft('Hope it is going well! DeepSeek shipped a new model.', item).ok).toBe(false);
  });

  it.each([
    'Wishing you the best with whatever you are building. DeepSeek shipped a model.',
    'Just following up, DeepSeek shipped a model.',
    'Just checking in, DeepSeek shipped a model.',
    'Hope you are doing well, DeepSeek shipped a model.',
  ])('rejects %s', (t) => {
    expect(checkValueDraft(t, item)).toMatchObject({ ok: false, reason: 'banned-phrase' });
  });

  it('rejects a draft that carries no value item', () => {
    expect(checkValueDraft('Love what you are doing, keep going! What are you building?', item)).toMatchObject({ ok: false, reason: 'no-value-item' });
  });

  it('allows at most one question', () => {
    expect(checkValueDraft('DeepSeek shipped a model. Want it? Using agents? Any plans?', item)).toMatchObject({ ok: false, reason: 'too-many-questions' });
  });

  it('allows at most three sentences', () => {
    expect(checkValueDraft('DeepSeek shipped a model. It is fast. It is cheap. Try it.', item)).toMatchObject({ ok: false, reason: 'too-long' });
  });

  it('never lets a news source url into a DM', () => {
    expect(checkValueDraft(`DeepSeek shipped a model, see ${item.url}`, item)).toMatchObject({ ok: false, reason: 'link-not-allowed' });
  });

  it('allows the guide link only when links are open, and only that guide link', () => {
    const g = GUIDES[0];
    const ok = `The ${g.anchors[0]} guide covers this, free: ${g.url}`;
    expect(checkValueDraft(ok, g, { linksBlocked: false }).ok).toBe(true);
    expect(checkValueDraft(ok, g, { linksBlocked: true })).toMatchObject({ ok: false, reason: 'link-not-allowed' });
    expect(checkValueDraft(`The ${g.anchors[0]} guide: https://varritech.com/other`, g, { linksBlocked: false })).toMatchObject({ ok: false });
  });

  it('rejects invented prices on the router offer', () => {
    expect(checkValueDraft('Our router is $5 a month, reply and I will set you up.', ROUTER_OFFER)).toMatchObject({ ok: false, reason: 'price' });
  });
});

describe('draftValueFollowUp', () => {
  it('returns the text and which item it carried', async () => {
    const llm = async () => 'DeepSeek just shipped a faster V4.1 Flash, handy if agent bills are creeping up. Running any agents?';
    const out = await draftValueFollowUp({ target: target(), library: lib(), sentIds: [], llm });
    expect(out.text).toMatch(/DeepSeek/);
    expect(out.valueId).toBeTruthy();
  });

  it('regenerates once on a bad draft, with the reason in the second prompt', async () => {
    const prompts = [];
    const llm = async ({ prompt }) => {
      prompts.push(prompt);
      return prompts.length === 1 ? 'Hope it is going well!' : 'DeepSeek shipped a faster V4.1 Flash, worth a look.';
    };
    const out = await draftValueFollowUp({ target: target(), library: lib([news()]), sentIds: lib().items.filter((i) => i.id !== news().id).map((i) => i.id), llm });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/banned-phrase/);
    expect(out.text).toMatch(/DeepSeek/);
  });

  it('skips and logs when the second attempt is also bad', async () => {
    const logs = [];
    const llm = async () => 'Hope it is going well!';
    const out = await draftValueFollowUp({ target: target(), library: lib(), sentIds: [], llm, log: (l) => logs.push(l) });
    expect(out).toMatchObject({ text: '', skipped: true });
    expect(logs.join('\n')).toMatch(/ana/);
    expect(logs.join('\n')).toMatch(/banned-phrase/);
  });

  it('skips with a reason when no unsent value item remains', async () => {
    const l = lib();
    const out = await draftValueFollowUp({ target: target(), library: l, sentIds: l.items.map((i) => i.id), llm: async () => 'x', log: () => {} });
    expect(out).toMatchObject({ text: '', skipped: true, reason: 'no-value-item-left' });
  });

  it('survives an llm error by skipping', async () => {
    const out = await draftValueFollowUp({ target: target(), library: lib(), sentIds: [], llm: async () => { throw new Error('boom'); }, log: () => {} });
    expect(out).toMatchObject({ text: '', skipped: true });
  });
});

describe('inferValueId', () => {
  it('recovers the item id from sent text so the ledger is right even if the runner forgets to pass it', () => {
    const l = lib();
    expect(inferValueId('DeepSeek shipped a model', l)).toBe('news-deepseek-v4-1-flash-1017');
    expect(inferValueId('Hey, we typically charge $149.99 for this guide. Here it is: https://varritech-product-playbook.vercel.app/guide-1', l)).toBe('guide-1');
    expect(inferValueId('unrelated chatter', l)).toBeNull();
  });
});

import { mergeNews, newsIsStale, saveNews } from '../src/value.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('daily news refresh', () => {
  it('merges new sourced items, dedupes by id, drops unsourced and expired', () => {
    const merged = mergeNews(
      [news({ id: 'old', date: '2026-10-01' }), news({ id: 'keep', date: '2026-10-20' })],
      [news({ id: 'keep', why: 'updated why' }), news({ id: 'nosrc', url: '' }), news({ id: 'new', date: '2026-10-21' })],
      NOW,
    );
    expect(merged.items.map((n) => n.id).sort()).toEqual(['keep', 'new']);
    expect(merged.items.find((n) => n.id === 'keep').why).toBe('updated why');
    expect(merged.dropped.map((d) => d.id).sort()).toEqual(['nosrc', 'old']);
  });

  it('is stale unless it was refreshed today', () => {
    expect(newsIsStale('2026-10-22', NOW)).toBe(false);
    expect(newsIsStale('2026-10-21', NOW)).toBe(true);
    expect(newsIsStale(undefined, NOW)).toBe(true);
  });

  it('saveNews writes the file loadNews reads, stamped with the day', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'n-')), 'v.json');
    saveNews(p, [news()], NOW);
    expect(JSON.parse(readFileSync(p, 'utf8'))).toMatchObject({ fetchedOn: '2026-10-22', news: [{ id: news().id }] });
  });
});

describe('niche guides need a reason', () => {
  it('with nothing known about the person, never leads with a niche guide (design system, QA, security...)', () => {
    const l = buildLibrary({ news: [news()], now: NOW });
    for (const n of [2, 3, 4, 5]) {
      const pick = pickValueItem({ target: { handle: 'x', followUpNumber: n }, library: l, sentIds: [] });
      expect(['guide-2', 'guide-4', 'guide-5', 'guide-8', 'guide-9']).not.toContain(pick.id);
    }
  });

  it('but picks the niche guide when what we know matches it', () => {
    const l = buildLibrary({ news: [], now: NOW });
    const pick = pickValueItem({ target: { handle: 'x', followUpNumber: 3, opener: 'working on our brand and figma design system' }, library: l, sentIds: [] });
    expect(pick.id).toBe('guide-2');
  });
});

describe('no invented knowledge about the person', () => {
  const item = news();
  it('rejects "saw you / thanks for checking out the post" when we know nothing about them', () => {
    expect(checkValueDraft('Hey, saw you vibing with AI lately. DeepSeek shipped a model.', item, { target: { handle: 'x' } })).toMatchObject({ ok: false, reason: 'invented-knowledge' });
    expect(checkValueDraft('Thanks for checking out the posts. DeepSeek shipped a model.', item, { target: { handle: 'x' } })).toMatchObject({ ok: false, reason: 'invented-knowledge' });
  });
  it('allows it when we actually know they engaged with a post', () => {
    expect(checkValueDraft('Saw you liked the post. DeepSeek shipped a model.', item, { target: { handle: 'x', caption: 'agents' } }).ok).toBe(true);
  });
  it('rejects a first name nobody gave us', () => {
    expect(checkValueDraft('Hey Sarah, DeepSeek shipped a model.', item, { target: { handle: 'sarah_vasquez' } })).toMatchObject({ ok: false, reason: 'invented-knowledge' });
  });
  it('a reopened old thread prefers fresh news over a generic offer', () => {
    const l = buildLibrary({ news: [news()], now: NOW });
    const pick = pickValueItem({ target: { handle: 'x', followUpNumber: 1, reopen: true }, library: l, sentIds: [] });
    expect(pick.type).toBe('news');
  });
  it('drops an unbalanced quote the model left behind', async () => {
    const llm = async () => 'DeepSeek shipped a model. Reply "router';
    const out = await draftValueFollowUp({ target: { handle: 'x', followUpNumber: 2 }, library: buildLibrary({ news: [news()], now: NOW }), sentIds: buildLibrary({ news: [], now: NOW }).items.map((i) => i.id), llm, log: () => {} });
    expect(out.text).not.toMatch(/"/);
  });
});
