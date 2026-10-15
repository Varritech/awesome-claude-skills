import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { inviteRound, acceptRound, followUpRound, replyRound } from '../src/pipeline.js';

const ledgerAt = () => createLedger({ path: join(mkdtempSync(join(tmpdir(), 'lp-')), 'l.json') });
const now = new Date('2026-10-15T15:00:00Z');
const DAY = 86400_000;
const iso = (ms) => new Date(+now - ms).toISOString();

function fakeBrowser(over = {}) {
  return {
    searchPage: vi.fn(async () => []),
    sendInvite: vi.fn(async () => true),
    connections: vi.fn(async () => []),
    sendMessage: vi.fn(async () => true),
    readThread: vi.fn(async () => []),
    ...over,
  };
}

describe('inviteRound', () => {
  it('does not even open search when today\'s allowance is spent', async () => {
    const ledger = ledgerAt();
    for (let i = 0; i < 5; i++) ledger.recordInvite(`p${i}`, { at: iso(3600_000) });
    const browser = fakeBrowser();
    const r = await inviteRound({ ledger, browser, now, searches: ['u'] });
    expect(browser.searchPage).not.toHaveBeenCalled();
    expect(r.invited).toEqual([]);
  });

  it('invites only connectable ICP strangers, records each one only after the browser confirms', async () => {
    const ledger = ledgerAt();
    ledger.recordSkip('old-friend', { at: iso(DAY), reason: 'x' });
    const browser = fakeBrowser({
      searchPage: vi.fn(async () => [
        { slug: 'dana', name: 'Dana W', headline: 'Owner, Whitfield HVAC', canConnect: true },
        { slug: 'rec', name: 'Rec', headline: 'Technical Recruiter', canConnect: true },
        { slug: 'old-friend', name: 'O', headline: 'Founder, X', canConnect: true },
        { slug: 'lee', name: 'Lee', headline: 'CEO at Chen Logistics', canConnect: false },
        { slug: 'flaky', name: 'F', headline: 'Founder at Flaky', canConnect: true },
      ]),
      sendInvite: vi.fn(async (slug) => slug !== 'flaky'),
    });
    const r = await inviteRound({ ledger, browser, now, searches: ['u'] });
    expect(browser.sendInvite.mock.calls.map((c) => c[0])).toEqual(['dana', 'flaky']);
    expect(r.invited).toEqual(['dana']);
    expect(ledger.get('dana')).toMatchObject({ name: 'Dana W', headline: 'Owner, Whitfield HVAC' });
    expect(ledger.has('flaky')).toBe(false);
  });

  it('sends each invite with the personal note and records whether the note made it', async () => {
    const ledger = ledgerAt();
    const browser = fakeBrowser({
      searchPage: vi.fn(async () => [
        { slug: 'dana', name: 'Dana Whitfield', headline: 'Owner, Whitfield HVAC', canConnect: true },
        { slug: 'raj', name: 'Raj Shah', headline: 'Founder, Shah Logistics', canConnect: true },
      ]),
      sendInvite: vi.fn(async (slug) => ({ ok: true, noted: slug === 'dana' })),
    });
    await inviteRound({ ledger, browser, now, searches: ['u'] });
    expect(browser.sendInvite.mock.calls[0][1].note).toMatch(/^Hi Dana, I run Varritech/);
    expect(browser.sendInvite.mock.calls[1][1].note).toMatch(/^Hi Raj,/);
    expect(ledger.get('dana').inviteNote).toMatch(/^Hi Dana/);
    expect(ledger.get('raj').inviteNote).toBe(null);
  });

  it('honours a daily cap override', async () => {
    const ledger = ledgerAt();
    const rows = Array.from({ length: 30 }, (_, i) => ({ slug: `p${i}`, name: `P ${i}`, headline: 'Owner, P Co', canConnect: true }));
    const browser = fakeBrowser({ searchPage: vi.fn(async (_s, page) => (page === 1 ? rows : [])) });
    const r = await inviteRound({ ledger, browser, now, searches: ['u'], dailyCap: 20 });
    expect(r.invited).toHaveLength(20);
  });

  it('stops at the first browser error instead of hammering LinkedIn', async () => {
    const ledger = ledgerAt();
    const browser = fakeBrowser({
      searchPage: vi.fn(async () => [
        { slug: 'a', name: 'A', headline: 'Owner, A', canConnect: true },
        { slug: 'b', name: 'B', headline: 'Owner, B', canConnect: true },
      ]),
      sendInvite: vi.fn(async () => { throw new Error('weekly invitation limit'); }),
    });
    const r = await inviteRound({ ledger, browser, now, searches: ['u'] });
    expect(browser.sendInvite).toHaveBeenCalledTimes(1);
    expect(r.error).toMatch(/weekly invitation limit/);
  });
});

describe('acceptRound', () => {
  it('opens only people THIS claw invited, never an existing connection', async () => {
    const ledger = ledgerAt();
    ledger.recordInvite('dana', { at: iso(2 * DAY), name: 'Dana Whitfield' });
    const browser = fakeBrowser({
      connections: vi.fn(async () => [
        { slug: 'dana', name: 'Dana Whitfield', recipient: 'R1', connectedOn: 'October 15, 2026' },
        { slug: 'tyron', name: 'Tyron Fandal', recipient: 'R2', connectedOn: 'September 25, 2026' },
      ]),
    });
    const r = await acceptRound({ ledger, browser, now, rate: { perHour: 10 } });
    expect(browser.sendMessage.mock.calls.map((c) => c[0].recipient)).toEqual(['R1']);
    expect(browser.sendMessage.mock.calls[0][0].text).toMatch(/^Hi Dana,/);
    expect(r.opened).toEqual(['dana']);
    expect(ledger.get('dana').messages).toHaveLength(1);
    expect(ledger.has('tyron')).toBe(false);
  });

  it('does not record an opener the browser could not verify', async () => {
    const ledger = ledgerAt();
    ledger.recordInvite('dana', { at: iso(2 * DAY), name: 'Dana' });
    const browser = fakeBrowser({
      connections: vi.fn(async () => [{ slug: 'dana', name: 'Dana', recipient: 'R1' }]),
      sendMessage: vi.fn(async () => false),
    });
    await acceptRound({ ledger, browser, now, rate: { perHour: 10 } });
    expect(ledger.get('dana').acceptedAt).toBeTruthy();
    expect(ledger.get('dana').messages).toHaveLength(0);
  });

  it('respects the hourly message rate', async () => {
    const ledger = ledgerAt();
    for (const s of ['a', 'b', 'c']) ledger.recordInvite(s, { at: iso(2 * DAY), name: s });
    const browser = fakeBrowser({ connections: vi.fn(async () => ['a', 'b', 'c'].map((s) => ({ slug: s, name: s, recipient: s }))) });
    const r = await acceptRound({ ledger, browser, now, rate: { perHour: 2 } });
    expect(r.opened).toHaveLength(2);
  });
});

describe('followUpRound', () => {
  const opened = (ledger, slug, days, extra = []) => {
    ledger.recordInvite(slug, { at: iso((days + 2) * DAY), name: 'Dana Whitfield' });
    ledger.setStage(slug, { recipient: `R-${slug}` });
    ledger.recordMessage(slug, { at: iso(days * DAY), from: 'us', text: 'opener', kind: 'opener' });
    for (const m of extra) ledger.recordMessage(slug, m);
  };

  it('knocks at day 3 then day 7 after the previous message, then never again', async () => {
    const ledger = ledgerAt();
    opened(ledger, 'due1', 3);
    opened(ledger, 'fresh', 1);
    opened(ledger, 'due2', 12, [{ at: iso(8 * DAY), from: 'us', text: 'k1', kind: 'followup-1' }]);
    opened(ledger, 'done', 30, [{ at: iso(25 * DAY), from: 'us', text: 'k1', kind: 'followup-1' }, { at: iso(15 * DAY), from: 'us', text: 'k2', kind: 'followup-2' }]);
    const browser = fakeBrowser();
    const r = await followUpRound({ ledger, browser, now, rate: { perHour: 10 } });
    expect(r.sent.sort()).toEqual(['due1', 'due2']);
    expect(ledger.get('due2').messages.at(-1).kind).toBe('followup-2');
  });

  it('never knocks on someone who replied, and checks the live thread first', async () => {
    const ledger = ledgerAt();
    opened(ledger, 'quiet', 4);
    const browser = fakeBrowser({ readThread: vi.fn(async () => [{ from: 'us', text: 'opener' }, { from: 'them', text: 'hey, tell me more' }]) });
    const r = await followUpRound({ ledger, browser, now, rate: { perHour: 10 } });
    expect(r.sent).toEqual([]);
    expect(browser.sendMessage).not.toHaveBeenCalled();
    expect(ledger.get('quiet').replied).toBe(true);
  });
});

describe('replyRound', () => {
  const lead = (ledger) => {
    ledger.recordInvite('dana', { at: iso(5 * DAY), name: 'Dana Whitfield', headline: 'Owner, Whitfield HVAC' });
    ledger.setStage('dana', { recipient: 'R1' });
    ledger.recordMessage('dana', { at: iso(4 * DAY), from: 'us', text: 'opener', kind: 'opener' });
  };

  it('syncs their new messages, drafts, sends, and records the verified reply', async () => {
    const ledger = ledgerAt();
    lead(ledger);
    const browser = fakeBrowser({ readThread: vi.fn(async () => [{ from: 'us', text: 'opener' }, { from: 'them', text: 'Scheduling. 14 people.' }]) });
    const llm = vi.fn(async () => JSON.stringify({ reply: 'Got it. Do you own the business?', qualified: null }));
    const r = await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 } });
    expect(llm.mock.calls[0][0].prompt).toContain('Scheduling. 14 people.');
    expect(browser.sendMessage.mock.calls[0][0].text).toBe('Got it. Do you own the business?');
    expect(r.replied).toEqual(['dana']);
    expect(ledger.get('dana').messages.map((m) => m.from)).toEqual(['us', 'them', 'us']);
  });

  it('does nothing when the last word is ours', async () => {
    const ledger = ledgerAt();
    lead(ledger);
    const browser = fakeBrowser({ readThread: vi.fn(async () => [{ from: 'us', text: 'opener' }]) });
    const llm = vi.fn();
    await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 } });
    expect(llm).not.toHaveBeenCalled();
  });

  it('a handoff parks the lead for Cristiano and the claw never auto-replies to them again', async () => {
    const ledger = ledgerAt();
    lead(ledger);
    const browser = fakeBrowser({ readThread: vi.fn(async () => [{ from: 'us', text: 'opener' }, { from: 'them', text: 'what does it cost exactly?' }]) });
    const llm = vi.fn(async () => JSON.stringify({ reply: '', handoff: true, reason: 'exact pricing' }));
    const r1 = await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 } });
    expect(r1.handoffs).toEqual([{ slug: 'dana', reason: 'exact pricing' }]);
    expect(browser.sendMessage).not.toHaveBeenCalled();
    await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 } });
    expect(llm).toHaveBeenCalledTimes(1);
  });
});

import { existingRound } from '../src/pipeline.js';

describe('existingRound (people already connected)', () => {
  const cursorMem = () => { let c = { search: 0, page: 1 }; return { get: () => c, set: (n) => { c = n; } }; };
  const row = (slug, headline, recipient = `R-${slug}`) => ({ slug, name: `${slug[0].toUpperCase()}${slug.slice(1)} Smith`, headline, degree: '1st', recipient });

  it('messages owner connections we have never spoken to, skips any existing thread for good', async () => {
    const ledger = ledgerAt();
    const browser = fakeBrowser({
      searchPage: vi.fn(async (_s, page) => (page === 1 ? [
        row('jim', 'Owner, Bilbo Law Office'),
        row('tyron', 'CEO at Sand Castle Floats'),
        row('emp', 'Account Executive at Salesforce'),
        row('ben', 'Founder at Primis'),
      ] : [])),
      readThread: vi.fn(async ({ recipient }) => (recipient === 'R-tyron' ? [{ from: 'them', text: 'about those fees...' }] : [])),
    });
    const r = await existingRound({ ledger, browser, now, rate: { perHour: 10 }, searches: ['u'], cursor: cursorMem(), dailyCap: 20 });
    expect(r.messaged).toEqual(['jim', 'ben']);
    expect(browser.sendMessage.mock.calls.map((c) => c[0].recipient)).toEqual(['R-jim', 'R-ben']);
    const text = browser.sendMessage.mock.calls[0][0].text;
    expect(text).toMatch(/^Hi Jim, I run Varritech/);
    expect(text).not.toMatch(/thanks for connecting/i);
    expect(ledger.get('tyron')).toMatchObject({ status: 'skipped', reason: 'existing-thread' });
    expect(ledger.has('emp')).toBe(false);
    expect(ledger.get('jim')).toMatchObject({ recipient: 'R-jim', existing: true });
    expect(ledger.get('jim').messages[0].kind).toBe('opener-existing');
  });

  it('respects its own daily cap and the shared hourly message rate', async () => {
    const ledger = ledgerAt();
    const rows = ['a', 'b', 'c', 'd'].map((s) => row(s, 'Owner, Co'));
    const mk = () => fakeBrowser({ searchPage: vi.fn(async (_s, p) => (p === 1 ? rows : [])) });
    const r1 = await existingRound({ ledger: ledgerAt(), browser: mk(), now, rate: { perHour: 10 }, searches: ['u'], cursor: cursorMem(), dailyCap: 2 });
    expect(r1.messaged).toHaveLength(2);
    const r2 = await existingRound({ ledger, browser: mk(), now, rate: { perHour: 3 }, searches: ['u'], cursor: cursorMem(), dailyCap: 20 });
    expect(r2.messaged).toHaveLength(3);
  });

  it('moves its cursor past pages with nobody new, so it works through the whole list', async () => {
    const ledger = ledgerAt();
    ledger.recordSkip('old', { at: now.toISOString(), reason: 'existing-thread' });
    const cursor = cursorMem();
    const browser = fakeBrowser({ searchPage: vi.fn(async (_s, page) => (page === 1 ? [row('old', 'Owner, X')] : page === 2 ? [row('new', 'Founder, Y')] : [])) });
    const r = await existingRound({ ledger, browser, now, rate: { perHour: 10 }, searches: ['u'], cursor, dailyCap: 20 });
    expect(r.messaged).toEqual(['new']);
    expect(cursor.get().page).toBeGreaterThanOrEqual(2);
  });
});

describe('a thread that cannot be read is never treated as empty', () => {
  it('existingRound skips (and does not record) anyone whose thread failed to load', async () => {
    const ledger = ledgerAt();
    const browser = fakeBrowser({
      searchPage: vi.fn(async (_s, p) => (p === 1 ? [
        { slug: 'anshul', name: 'Anshul C', headline: 'Founder & CEO at KAYGEN', degree: '1st', recipient: 'R-a' },
        { slug: 'marc', name: 'Marc Koehl', headline: 'Founder of The Soap Farm', degree: '1st', recipient: 'R-m' },
      ] : [])),
      readThread: vi.fn(async ({ recipient }) => { if (recipient === 'R-a') throw new Error('thread did not load for Anshul C'); return []; }),
    });
    const r = await existingRound({ ledger, browser, now, rate: { perHour: 10 }, searches: ['u'], cursor: { get: () => ({ search: 0, page: 1 }), set: () => {} }, dailyCap: 20 });
    expect(browser.sendMessage.mock.calls.map((c) => c[0].recipient)).toEqual(['R-m']);
    expect(browser.sendMessage.mock.calls[0][0].name).toBe('Marc Koehl');
    expect(ledger.has('anshul')).toBe(false);
    expect(r.messaged).toEqual(['marc']);
  });

  it('followUpRound and replyRound pass the name through and stop cleanly on a read failure', async () => {
    const ledger = ledgerAt();
    ledger.recordInvite('dana', { at: iso(9 * DAY), name: 'Dana Whitfield' });
    ledger.setStage('dana', { recipient: 'R1' });
    ledger.recordMessage('dana', { at: iso(4 * DAY), from: 'us', text: 'opener', kind: 'opener' });
    const browser = fakeBrowser({ readThread: vi.fn(async () => { throw new Error('thread did not load'); }) });
    const f = await followUpRound({ ledger, browser, now, rate: { perHour: 10 } });
    expect(f.error).toMatch(/did not load/);
    expect(browser.readThread.mock.calls[0][0].name).toBe('Dana Whitfield');
    const r = await replyRound({ ledger, browser, llm: vi.fn(), now, rate: { perHour: 10 } });
    expect(r.error).toMatch(/did not load/);
    expect(browser.sendMessage).not.toHaveBeenCalled();
  });
});

describe('one unreadable thread does not stop the round', () => {
  it('replyRound skips the person it cannot open and still answers the next one', async () => {
    const ledger = ledgerAt();
    for (const [slug, name] of [['ghost', 'Ghost Person'], ['dana', 'Dana Whitfield']]) {
      ledger.recordInvite(slug, { at: iso(5 * DAY), name });
      ledger.setStage(slug, { recipient: `R-${slug}` });
      ledger.recordMessage(slug, { at: iso(4 * DAY), from: 'us', text: 'opener', kind: 'opener' });
    }
    const browser = fakeBrowser({
      readThread: vi.fn(async ({ name }) => { if (name === 'Ghost Person') throw new Error('could not find Ghost Person\'s card'); return [{ from: 'us', text: 'opener' }, { from: 'them', text: 'tell me more' }]; }),
    });
    const llm = vi.fn(async () => JSON.stringify({ reply: 'Happy to. What eats most of your week?', qualified: null }));
    const r = await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 } });
    expect(r.replied).toEqual(['dana']);
    expect(r.error).toMatch(/Ghost Person/);
  });
});

describe('replyRound with the inbox list', () => {
  it('opens only leads whose latest inbox line is from them; never touches non-leads', async () => {
    const ledger = ledgerAt();
    for (const [slug, name] of [['dana', 'Dana Whitfield'], ['quiet', 'Quiet Person']]) {
      ledger.recordInvite(slug, { at: iso(5 * DAY), name });
      ledger.setStage(slug, { recipient: `R-${slug}` });
      ledger.recordMessage(slug, { at: iso(1 * DAY), from: 'us', text: 'opener', kind: 'opener' });
    }
    const inbox = [
      { name: 'Dana Whitfield', snippet: 'Dana: what does it involve?', fromUs: false },
      { name: 'Quiet Person', snippet: 'You: Hi Quiet...', fromUs: true },
      { name: 'Nilesh Divekar', snippet: 'Nilesh: one more thought', fromUs: false },
    ];
    const browser = fakeBrowser({ readThread: vi.fn(async () => [{ from: 'us', text: 'opener' }, { from: 'them', text: 'what does it involve?' }]) });
    const llm = vi.fn(async () => JSON.stringify({ reply: 'Short version: we map your hours, build one agent free. Do you own the business?', qualified: null }));
    const r = await replyRound({ ledger, browser, llm, now, rate: { perHour: 10 }, inbox });
    expect(browser.readThread.mock.calls.map((c) => c[0].name)).toEqual(['Dana Whitfield']);
    expect(r.replied).toEqual(['dana']);
  });
});
