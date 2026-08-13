import { describe, it, expect } from 'vitest';
import { recordOpener } from '../src/handoff.js';

const fakeStore = () => {
  const docs = new Map();
  return {
    docs,
    async get(coll, key) { return docs.get(`${coll}/${key}`) ?? null; },
    async set(coll, key, value) { docs.set(`${coll}/${key}`, value); },
  };
};

describe('recordOpener', () => {
  it('writes the opener into ig_threads as an "us" turn when the IGSID is known', async () => {
    const store = fakeStore();
    await recordOpener({
      store,
      target: { handle: 'ana', igUserId: '1275011341496679' },
      text: 'Saw you liked the render post. What are you building?',
    });

    // Exactly the shape ConversationStore reads, so deriveStage() sees us at 1 turn.
    expect(store.docs.get('ig_threads/1275011341496679')).toEqual({
      turns: [{ role: 'us', text: 'Saw you liked the render post. What are you building?' }],
    });
  });

  it('parks the opener under the handle when the IGSID could not be resolved', async () => {
    const store = fakeStore();
    const where = await recordOpener({
      store,
      target: { handle: 'bob' },   // no igUserId
      text: 'Hey, saw you followed. What are you working on?',
      now: '2026-08-13T14:00:00.000Z',
    });

    expect(where.collection).toBe('ig_pending_openers');
    // Must NOT fabricate a thread doc keyed by handle - the sales claw reads IGSIDs.
    expect([...store.docs.keys()].some((k) => k.startsWith('ig_threads/'))).toBe(false);
    expect(store.docs.get('ig_pending_openers/bob')).toMatchObject({ handle: 'bob' });
  });

  it('appends to an existing thread instead of clobbering it', async () => {
    const store = fakeStore();
    await store.set('ig_threads', '99', { turns: [{ role: 'them', text: 'hi' }] });
    await recordOpener({ store, target: { handle: 'ana', igUserId: '99' }, text: 'hey back' });

    expect(store.docs.get('ig_threads/99').turns).toEqual([
      { role: 'them', text: 'hi' },
      { role: 'us', text: 'hey back' },
    ]);
  });
});
