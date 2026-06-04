import { describe, it, expect, vi } from 'vitest';
import { resolveInboxForEmails, type QueuedEmail } from './resolve-inbox';

/**
 * Minimal Firestore stub. Implements only the chain we actually call:
 *   db.collection('inboxes').where(...).where(...).limit(1).get()
 *   db.collection('emails').doc(id).set({...}, { merge: true })
 *
 * Other collection access is unsupported by design (these tests don't need it).
 */
function makeDb(opts: {
  inboxesByUser: Record<string, { id: string; status: string }[]>;
  emailSetCalls?: Array<{ id: string; patch: Record<string, unknown> }>;
}): {
  db: Parameters<typeof resolveInboxForEmails>[0];
  inboxQueryCount: () => number;
} {
  let inboxQueryCount = 0;
  const setCalls = opts.emailSetCalls ?? [];

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'inboxes') {
        return {
          where: vi.fn((field: string, _op: string, value: unknown) => {
            const where2 = {
              where: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(async () => {
                    inboxQueryCount++;
                    if (field !== 'userId') throw new Error('first where must be userId');
                    const list = opts.inboxesByUser[value as string] ?? [];
                    const match = list.find((i) =>
                      ['warming', 'active'].includes(i.status),
                    );
                    return match
                      ? { empty: false, docs: [{ id: match.id }] }
                      : { empty: true, docs: [] };
                  }),
                })),
              })),
            };
            return where2;
          }),
        };
      }
      if (name === 'emails') {
        return {
          doc: vi.fn((id: string) => ({
            set: vi.fn(async (patch: Record<string, unknown>) => {
              setCalls.push({ id, patch });
            }),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    }),
  } as unknown as Parameters<typeof resolveInboxForEmails>[0];

  return { db, inboxQueryCount: () => inboxQueryCount };
}

const email = (overrides: Partial<QueuedEmail> = {}): QueuedEmail => ({
  id: 'em_1',
  userId: 'u1',
  status: 'queued',
  ...overrides,
});

describe('resolveInboxForEmails', () => {
  it('leaves records with an inboxId untouched and does no lookups', async () => {
    const setCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const { db, inboxQueryCount } = makeDb({ inboxesByUser: {}, emailSetCalls: setCalls });
    const emails = [email({ id: 'a', inboxId: 'ib_existing' })];

    const result = await resolveInboxForEmails(db, emails);

    expect(result.resolved).toBe(0);
    expect(result.skippedNoInbox).toBe(0);
    expect(emails[0]!.inboxId).toBe('ib_existing');
    expect(inboxQueryCount()).toBe(0);
    expect(setCalls).toHaveLength(0);
  });

  it('resolves one inbox per user and writes it back to each email', async () => {
    const setCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const { db, inboxQueryCount } = makeDb({
      inboxesByUser: { u1: [{ id: 'ib_u1', status: 'warming' }] },
      emailSetCalls: setCalls,
    });
    const emails = [email({ id: 'a' }), email({ id: 'b' })];

    const result = await resolveInboxForEmails(db, emails);

    expect(result.resolved).toBe(2);
    expect(result.skippedNoInbox).toBe(0);
    expect(emails[0]!.inboxId).toBe('ib_u1');
    expect(emails[1]!.inboxId).toBe('ib_u1');
    expect(inboxQueryCount()).toBe(1); // cache prevents second lookup
    expect(setCalls.map((c) => c.id)).toEqual(['a', 'b']);
    expect(setCalls.every((c) => c.patch.inboxId === 'ib_u1')).toBe(true);
  });

  it('caches the no-inbox result and skips subsequent records for the same user', async () => {
    const { db, inboxQueryCount } = makeDb({ inboxesByUser: {} });
    const emails = [email({ id: 'a' }), email({ id: 'b' }), email({ id: 'c' })];

    const result = await resolveInboxForEmails(db, emails);

    expect(result.resolved).toBe(0);
    expect(result.skippedNoInbox).toBe(3);
    expect(inboxQueryCount()).toBe(1);
    expect(emails.every((e) => !e.inboxId)).toBe(true);
  });

  it('handles multiple users with different inbox states', async () => {
    const { db } = makeDb({
      inboxesByUser: {
        u1: [{ id: 'ib_u1', status: 'warming' }],
        u2: [], // no active inbox
        u3: [{ id: 'ib_u3', status: 'active' }],
      },
    });
    const emails = [
      email({ id: 'a', userId: 'u1' }),
      email({ id: 'b', userId: 'u2' }),
      email({ id: 'c', userId: 'u3' }),
      email({ id: 'd', userId: 'u2' }),
    ];

    const result = await resolveInboxForEmails(db, emails);

    expect(result.resolved).toBe(2);
    expect(result.skippedNoInbox).toBe(2);
    expect(emails[0]!.inboxId).toBe('ib_u1');
    expect(emails[1]!.inboxId).toBeUndefined();
    expect(emails[2]!.inboxId).toBe('ib_u3');
    expect(emails[3]!.inboxId).toBeUndefined();
  });

  it('ignores inboxes whose status is not warming/active', async () => {
    const { db } = makeDb({
      inboxesByUser: { u1: [{ id: 'ib_u1', status: 'connecting' }] },
    });
    const emails = [email({ id: 'a' })];

    const result = await resolveInboxForEmails(db, emails);

    expect(result.resolved).toBe(0);
    expect(result.skippedNoInbox).toBe(1);
  });

  it('returns zero counts for an empty input', async () => {
    const { db, inboxQueryCount } = makeDb({ inboxesByUser: {} });
    const result = await resolveInboxForEmails(db, []);
    expect(result).toEqual({ resolved: 0, skippedNoInbox: 0 });
    expect(inboxQueryCount()).toBe(0);
  });
});
