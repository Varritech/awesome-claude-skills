import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger.js';
import { inboundRound } from '../src/pipeline.js';
import { qualifyInbound } from '../src/qualify.js';

const ledgerAt = () => createLedger({ path: join(mkdtempSync(join(tmpdir(), 'li-in-')), 'l.json') });
const now = new Date('2026-10-15T22:00:00Z');
const founder = { title: 'Founder & CEO', company: 'Whitfield HVAC', companyInfo: 'Construction · 11-50 employees', headline: 'Founder & CEO at Whitfield HVAC' };

describe('qualifyInbound', () => {
  it('rejects without asking the model when the current title is not an owner/founder', async () => {
    const llm = vi.fn();
    const r = await qualifyInbound({ profile: { ...founder, title: 'AI Engineer', headline: 'AI Engineer | RAG' }, thread: [], llm });
    expect(r).toMatchObject({ qualified: false });
    expect(llm).not.toHaveBeenCalled();
  });

  it('asks the model about company + conversation, and only a clear yes qualifies', async () => {
    const yes = await qualifyInbound({ profile: founder, thread: [{ from: 'them', text: 'How does your AI stuff work?' }], llm: async () => '{"qualified": true, "reason": "owner of a 30-person HVAC company asking about the offer"}' });
    expect(yes.qualified).toBe(true);
    const dispute = await qualifyInbound({ profile: founder, thread: [{ from: 'them', text: 'We were not aware of these fees' }], llm: async () => '{"qualified": false, "reason": "existing client billing dispute"}' });
    expect(dispute).toMatchObject({ qualified: false, reason: 'existing client billing dispute' });
    const junk = await qualifyInbound({ profile: founder, thread: [], llm: async () => 'sure!' });
    expect(junk.qualified).toBe(false);
  });
});

describe('inboundRound (people who messaged first, not claw leads)', () => {
  const inbox = [
    { name: 'Dana Whitfield', snippet: 'Dana: how does it work?', fromUs: false },
    { name: 'Tyron Fandal', snippet: 'Tyron: we were not aware of these fees', fromUs: false },
    { name: 'Excluded Client', snippet: 'Excluded: hi', fromUs: false },
    { name: 'Robert Batchko', snippet: 'You: Hi Robert', fromUs: true },
    { name: 'Maria Clark', snippet: 'Sponsored • side gig', fromUs: false },
  ];

  it('profiles each one, replies only to qualified founders, and remembers every decision', async () => {
    const ledger = ledgerAt();
    const browser = {
      profileOf: vi.fn(async ({ name }) => ({ slug: name.toLowerCase().replace(/ /g, '-'), recipient: `R-${name}`, ...founder, name })),
      readThread: vi.fn(async ({ name }) => [{ from: 'them', text: name === 'Tyron Fandal' ? 'we were not aware of these fees' : 'how does it work?' }]),
      sendMessage: vi.fn(async () => true),
    };
    const qualify = vi.fn(async ({ profile }) => (profile.name === 'Dana Whitfield' ? { qualified: true, reason: 'owner asking' } : { qualified: false, reason: 'client dispute' }));
    const llm = vi.fn(async () => JSON.stringify({ reply: 'Short version: we map where the hours go and build one agent free. How many people on the team?', qualified: null }));
    const r = await inboundRound({ ledger, browser, llm, qualify, now, rate: { perHour: 10 }, inbox, exclude: ['Excluded Client'] });
    expect(browser.profileOf.mock.calls.map((c) => c[0].name)).toEqual(['Dana Whitfield', 'Tyron Fandal']);
    expect(r.replied).toEqual(['dana-whitfield']);
    expect(browser.sendMessage).toHaveBeenCalledTimes(1);
    expect(ledger.get('tyron-fandal')).toMatchObject({ status: 'skipped', reason: 'inbound-unqualified: client dispute' });
    expect(ledger.get('dana-whitfield')).toMatchObject({ inbound: true, qualifiedBy: 'owner asking' });
    // second run: nobody is re-profiled
    browser.profileOf.mockClear();
    await inboundRound({ ledger, browser, llm, qualify, now, rate: { perHour: 10 }, inbox, exclude: ['Excluded Client'] });
    expect(browser.profileOf).not.toHaveBeenCalled();
  });
});
