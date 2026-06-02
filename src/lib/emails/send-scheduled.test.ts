import { describe, it, expect, vi } from 'vitest';
import { buildSendEvents, type QueuedEmail } from './send-scheduled';

function email(overrides: Partial<QueuedEmail> = {}): QueuedEmail {
  return {
    id: 'em_1',
    userId: 'usr_1',
    status: 'queued',
    scheduledFor: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('buildSendEvents', () => {
  it('emits one event per email when inboxId is already set on each record', async () => {
    const queued = [
      email({ id: 'em_a', userId: 'u1', inboxId: 'ib_1' }),
      email({ id: 'em_b', userId: 'u1', inboxId: 'ib_1' }),
    ];
    const resolve = vi.fn();

    const { events, skippedNoInbox } = await buildSendEvents(queued, resolve);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      name: 'email/send',
      data: { emailId: 'em_a', inboxId: 'ib_1', userId: 'u1' },
    });
    expect(skippedNoInbox).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('resolves inboxId once per user and caches across emails', async () => {
    const queued = [
      email({ id: 'em_a', userId: 'u1', inboxId: null }),
      email({ id: 'em_b', userId: 'u1', inboxId: null }),
      email({ id: 'em_c', userId: 'u2', inboxId: null }),
    ];
    const resolve = vi.fn(async (uid: string) => (uid === 'u1' ? 'ib_u1' : 'ib_u2'));

    const { events, skippedNoInbox } = await buildSendEvents(queued, resolve);

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.data.inboxId)).toEqual(['ib_u1', 'ib_u1', 'ib_u2']);
    expect(skippedNoInbox).toBe(0);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenNthCalledWith(1, 'u1');
    expect(resolve).toHaveBeenNthCalledWith(2, 'u2');
  });

  it('skips emails when the user has no active inbox', async () => {
    const queued = [
      email({ id: 'em_a', userId: 'u1', inboxId: null }),
      email({ id: 'em_b', userId: 'u2', inboxId: 'ib_2' }),
    ];
    const resolve = vi.fn(async () => null);

    const { events, skippedNoInbox } = await buildSendEvents(queued, resolve);

    expect(events).toHaveLength(1);
    expect(events[0].data.emailId).toBe('em_b');
    expect(skippedNoInbox).toBe(1);
  });

  it('caches a null inbox lookup so a missing-inbox user is only probed once', async () => {
    const queued = [
      email({ id: 'em_a', userId: 'u1', inboxId: null }),
      email({ id: 'em_b', userId: 'u1', inboxId: null }),
      email({ id: 'em_c', userId: 'u1', inboxId: null }),
    ];
    const resolve = vi.fn(async () => null);

    const { events, skippedNoInbox } = await buildSendEvents(queued, resolve);

    expect(events).toHaveLength(0);
    expect(skippedNoInbox).toBe(3);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('prefers the per-record inboxId over the resolver result', async () => {
    const queued = [email({ id: 'em_a', userId: 'u1', inboxId: 'ib_record' })];
    const resolve = vi.fn(async () => 'ib_resolved');

    const { events } = await buildSendEvents(queued, resolve);

    expect(events[0].data.inboxId).toBe('ib_record');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns an empty result for an empty input', async () => {
    const resolve = vi.fn();
    const { events, skippedNoInbox } = await buildSendEvents([], resolve);
    expect(events).toEqual([]);
    expect(skippedNoInbox).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('does not re-resolve a cached inbox even if a later record has an explicit different inboxId', async () => {
    const queued = [
      email({ id: 'em_a', userId: 'u1', inboxId: null }),
      email({ id: 'em_b', userId: 'u1', inboxId: 'ib_override' }),
      email({ id: 'em_c', userId: 'u1', inboxId: null }),
    ];
    const resolve = vi.fn(async () => 'ib_resolved');

    const { events } = await buildSendEvents(queued, resolve);

    expect(events.map((e) => e.data.inboxId)).toEqual(['ib_resolved', 'ib_override', 'ib_resolved']);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
