import { describe, it, expect } from 'vitest';
import { restFirestoreStore, DOC_URL } from '../src/firestore-store.js';

const token = async () => 'tok123';

describe('restFirestoreStore', () => {
  it('writes a doc with the access token, and encodes values Firestore can read', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) }; };
    const store = restFirestoreStore({ project: 'p1', token, fetchImpl });

    await store.set('ig_pending_openers', 'someone', { handle: 'someone', text: 'hi', openedAt: '2026-08-17T00:00:00Z' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(DOC_URL('p1', 'ig_pending_openers', 'someone'));
    expect(calls[0].init.method).toBe('PATCH');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok123');
    expect(JSON.parse(calls[0].init.body)).toEqual({
      fields: {
        handle: { stringValue: 'someone' },
        text: { stringValue: 'hi' },
        openedAt: { stringValue: '2026-08-17T00:00:00Z' },
      },
    });
  });

  it('decodes a doc back into plain values', async () => {
    const fetchImpl = async () => ({
      ok: true, status: 200,
      json: async () => ({ fields: { handle: { stringValue: 'someone' }, turns: { arrayValue: { values: [{ mapValue: { fields: { role: { stringValue: 'us' }, text: { stringValue: 'hi' } } } }] } } } }),
    });
    const store = restFirestoreStore({ project: 'p1', token, fetchImpl });
    expect(await store.get('ig_threads', '123')).toEqual({ handle: 'someone', turns: [{ role: 'us', text: 'hi' }] });
  });

  it('returns null for a doc that does not exist, rather than throwing', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => 'not found' });
    const store = restFirestoreStore({ project: 'p1', token, fetchImpl });
    expect(await store.get('ig_threads', 'nope')).toBe(null);
  });

  it('throws on a real failure so commitSend can report it', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'invalid_rapt' });
    const store = restFirestoreStore({ project: 'p1', token, fetchImpl });
    await expect(store.set('c', 'k', { a: 1 })).rejects.toThrow(/401/);
  });
});
