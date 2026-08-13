import { describe, it, expect, vi } from 'vitest';
import { runOnce } from '../src/run.js';

const WORKDAY = new Date('2026-08-13T14:00:00-04:00');

const harness = (over = {}) => {
  const contacted = new Set();
  const sent = [];
  return {
    now: WORKDAY,
    cap: 5,
    sleep: vi.fn(async () => {}),
    drive: async (s) =>
      ({ readNewFollowers: [{ handle: 'ana' }, { handle: 'bob' }], readRecentPosts: [], readPostLikers: [] }[s.op] ?? []),
    ledger: { has: (h) => contacted.has(h), record: (h) => contacted.add(h), _set: contacted },
    llm: async () => 'Hey, what are you building?',
    store: { get: async () => null, set: async () => {} },
    send: async (t) => { sent.push(t.handle); },
    _sent: sent,
    ...over,
  };
};

describe('runOnce', () => {
  it('does not mark someone contacted when the send fails', async () => {
    const h = harness({
      send: async (t) => { if (t.handle === 'ana') throw new Error('IG rate limited'); },
    });
    const result = await runOnce(h);

    expect(h.ledger._set.has('ana')).toBe(false);  // must be retryable next hour
    expect(h.ledger._set.has('bob')).toBe(true);   // one failure does not abort the run
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('pauses between every send so the cadence is not machine-uniform', async () => {
    const h = harness();
    await runOnce(h);
    expect(h._sent).toEqual(['ana', 'bob']);
    expect(h.sleep).toHaveBeenCalledTimes(2);
  });

  it('sends nothing at all when the kill switch is on', async () => {
    const h = harness({ killSwitch: true });
    const result = await runOnce(h);
    expect(h._sent).toEqual([]);
    expect(result.sent).toBe(0);
  });

  it('re-drafts per person instead of reusing one broadcast message', async () => {
    const seen = [];
    const h = harness({ llm: async ({ target }) => { seen.push(target.handle); return `hi ${target.handle}`; } });
    await runOnce(h);
    expect(seen).toEqual(['ana', 'bob']);
  });
});
