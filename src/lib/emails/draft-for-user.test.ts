/**
 * Tests for draftEmailsForUser — the shared drafting logic used by
 * /api/emails/auto-draft and /api/cron/auto-draft-daily.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { draftEmailsForUser } from './draft-for-user';

vi.mock('@/lib/ollama/client', () => ({
  chat: vi.fn(async () => '{"subject":"Hi {{company}}","body":"Hi {{firstName}}, ..."}'),
}));

vi.mock('@/lib/leads/fetch', () => ({
  fetchUserLeads: vi.fn(),
}));

import { fetchUserLeads } from '@/lib/leads/fetch';

interface FakeDoc {
  exists?: boolean;
  data?: () => unknown;
  id?: string;
}

function makeDb(opts: {
  existingDrafts?: number;
  preferredStyle?: string;
  hasInbox?: boolean;
  setSpy?: ReturnType<typeof vi.fn>;
}) {
  const setSpy = opts.setSpy ?? vi.fn();
  const collections: Record<string, unknown> = {
    emails: {
      where: () => ({
        where: () => ({
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: (opts.existingDrafts ?? 0) === 0,
                docs: [],
              }),
            }),
          }),
        }),
      }),
      doc: () => ({
        set: setSpy,
      }),
    },
    users: {
      doc: () => ({
        get: async (): Promise<FakeDoc> => ({
          exists: true,
          data: () =>
            opts.preferredStyle ? { preferredStyle: opts.preferredStyle } : {},
        }),
      }),
    },
    inboxes: {
      where: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({
              empty: !opts.hasInbox,
              docs: opts.hasInbox ? [{ id: 'ib_1' }] : [],
            }),
          }),
        }),
      }),
    },
  };

  return {
    collection: (name: string) => collections[name] as never,
  };
}

describe('draftEmailsForUser', () => {
  beforeEach(() => {
    vi.mocked(fetchUserLeads).mockReset();
  });

  it('returns alreadyDrafted=true when drafts already exist for the window', async () => {
    const db = makeDb({ existingDrafts: 1 });
    // Stub returning a non-empty .docs but empty=false would mean existing — use the makeDb signature
    // We need to override behaviour: re-make with custom emails collection.
    const customDb = {
      ...db,
      collection: (name: string) => {
        if (name === 'emails') {
          return {
            where: () => ({
              where: () => ({
                where: () => ({
                  limit: () => ({
                    get: async () => ({ empty: false, docs: [{}] }),
                  }),
                }),
              }),
            }),
          } as never;
        }
        return db.collection(name);
      },
    };
    const result = await draftEmailsForUser(customDb as never, 'user_1');
    expect(result.alreadyDrafted).toBe(true);
    expect(result.drafted).toBe(0);
  });

  it('returns noInbox=true when user has no connected inbox', async () => {
    vi.mocked(fetchUserLeads).mockResolvedValue([]);
    const db = makeDb({ hasInbox: false });
    const result = await draftEmailsForUser(db as never, 'user_1');
    expect(result.noInbox).toBe(true);
    expect(result.drafted).toBe(0);
  });

  it('returns noLeads=true when user has inbox but no leads', async () => {
    vi.mocked(fetchUserLeads).mockResolvedValue([]);
    const db = makeDb({ hasInbox: true });
    const result = await draftEmailsForUser(db as never, 'user_1');
    expect(result.noLeads).toBe(true);
    expect(result.drafted).toBe(0);
  });

  it('drafts one email per lead and uses saved persona', async () => {
    vi.mocked(fetchUserLeads).mockResolvedValue([
      { id: 'ld_1', firstName: 'Alex', company: 'Acme', status: 'new' } as never,
      { id: 'ld_2', firstName: 'Sam', company: 'Beta', status: 'new' } as never,
    ]);
    const setSpy = vi.fn();
    const db = makeDb({ hasInbox: true, preferredStyle: 'expert', setSpy });
    const result = await draftEmailsForUser(db as never, 'user_1');
    expect(result.drafted).toBe(2);
    expect(setSpy).toHaveBeenCalledTimes(2);
    const firstCall = setSpy.mock.calls[0]?.[0] as { persona: string; status: string };
    expect(firstCall.persona).toBe('expert');
    expect(firstCall.status).toBe('queued');
  });
});
