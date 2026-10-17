import { describe, it, expect, vi } from 'vitest';
import { openDbLedger, supabaseStore } from '../src/ledger.js';
import { acceptRound } from '../src/pipeline.js';

const now = new Date('2026-10-16T15:00:00Z');

/** An in-memory stand-in for the database, async like the real one. */
function memStore(seed = {}) {
  const rows = { ...seed };
  const messages = [];
  return {
    rows, messages,
    load: vi.fn(async () => Object.values(rows).map((r) => structuredClone(r))),
    saveEntry: vi.fn(async (e) => { await null; rows[e.slug] = structuredClone(e); }),
    addMessage: vi.fn(async (slug, seq, m) => { await null; messages.push({ slug, seq, ...m }); }),
  };
}

describe('the database is the source of truth', () => {
  it('loads every lead from the database on open', async () => {
    const store = memStore({ dana: { slug: 'dana', name: 'Dana', invitedAt: '2026-10-10T00:00:00Z', messages: [] } });
    const ledger = await openDbLedger({ store });
    expect(ledger.has('dana')).toBe(true);
    expect(ledger.get('dana').name).toBe('Dana');
  });

  it('every write lands in the database before it returns, messages one row each in order', async () => {
    const store = memStore();
    const ledger = await openDbLedger({ store });
    await ledger.recordInvite('dana', { at: '2026-10-10T00:00:00Z', name: 'Dana' });
    expect(store.rows.dana).toMatchObject({ slug: 'dana', name: 'Dana' });
    await ledger.recordMessage('dana', { at: '2026-10-11T00:00:00Z', from: 'us', text: 'hi', kind: 'opener' });
    await ledger.recordMessage('dana', { at: '2026-10-12T00:00:00Z', from: 'them', text: 'hey' });
    expect(store.rows.dana).toMatchObject({ owner: 'claw', clawMessagedAt: '2026-10-11T00:00:00Z' });
    expect(store.messages.map((m) => [m.seq, m.from, m.text])).toEqual([[0, 'us', 'hi'], [1, 'them', 'hey']]);
  });

  it('a database failure stops the whole run: no further messages go out unrecorded', async () => {
    const store = memStore();
    const ledger = await openDbLedger({ store });
    for (const s of ['a', 'b']) await ledger.recordInvite(s, { at: '2026-10-14T00:00:00Z', name: s });
    store.addMessage.mockRejectedValue(new Error('supabase 503'));
    const browser = {
      connections: vi.fn(async () => ['a', 'b'].map((s) => ({ slug: s, name: s, recipient: s }))),
      readThread: vi.fn(async () => []),
      sendMessage: vi.fn(async () => true),
    };
    await expect(acceptRound({ ledger, browser, now, rate: { perHour: 10 } })).rejects.toThrow(/supabase 503/);
    expect(browser.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe('supabaseStore', () => {
  const fake = (body = []) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body, text: async () => '' }));

  it('loads leads from linkedin_claw_leads', async () => {
    const fetchImpl = fake([{ data: { slug: 'dana', messages: [] } }]);
    const store = supabaseStore({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    expect(await store.load()).toEqual([{ slug: 'dana', messages: [] }]);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/rest\/v1\/linkedin_claw_leads\?select=data/);
  });

  it('upserts the lead with queryable columns and inserts each message once', async () => {
    const fetchImpl = fake();
    const store = supabaseStore({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    const e = { slug: 'dana', name: 'Dana', owner: 'claw', clawMessagedAt: '2026-10-11T00:00:00Z', handoff: false, invitedAt: '2026-10-10T00:00:00Z', messages: [] };
    await store.saveEntry(e);
    const [u1, o1] = fetchImpl.mock.calls[0];
    expect(u1).toMatch(/linkedin_claw_leads\?on_conflict=slug$/);
    expect(o1.headers.Prefer).toMatch(/merge-duplicates/);
    expect(JSON.parse(o1.body)).toMatchObject({ slug: 'dana', owner: 'claw', claw_messaged_at: '2026-10-11T00:00:00Z', invited_at: '2026-10-10T00:00:00Z', data: e });
    await store.addMessage('dana', 0, { at: '2026-10-11T00:00:00Z', from: 'us', text: 'hi', kind: 'opener' });
    const [u2, o2] = fetchImpl.mock.calls[1];
    expect(u2).toMatch(/linkedin_claw_messages\?on_conflict=slug,seq$/);
    expect(o2.headers.Prefer).toMatch(/ignore-duplicates/);
    expect(JSON.parse(o2.body)).toEqual({ slug: 'dana', seq: 0, at: '2026-10-11T00:00:00Z', from_side: 'us', by_claw: true, kind: 'opener', text: 'hi' });
  });

  it('throws on a failed write so nothing is assumed saved', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => 'down' }));
    const store = supabaseStore({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    await expect(store.saveEntry({ slug: 'dana', messages: [] })).rejects.toThrow(/503/);
  });
});
