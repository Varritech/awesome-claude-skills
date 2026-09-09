/*
 * Where the concierge gets its people.
 *
 * Deliberately an authenticated read endpoint on varritech.com rather than a
 * direct Supabase connection: the service-role key writes every table in the
 * production database, and there is no version of "a claw on a laptop holds
 * it" that is worth the convenience. The endpoint returns capture rows and
 * nothing else, and it is the only thing this process can reach.
 */
import { describe, it, expect } from 'vitest';
import { createLeadSource } from '../src/leads.js';

const okJson = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

function capture(response) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return { calls, fetchImpl };
}

describe('createLeadSource', () => {
  it('authenticates the read and asks for a bounded window', async () => {
    const { calls, fetchImpl } = capture(okJson({ leads: [] }));
    const src = createLeadSource({ baseUrl: 'https://www.varritech.com', token: 'T0KEN', fetchImpl });

    await src.recent({ days: 7 });

    expect(calls[0].url).toContain('/api/nurture/sms-queue');
    expect(calls[0].url).toContain('days=7');
    expect(calls[0].init.headers.authorization).toBe('Bearer T0KEN');
  });

  it('returns only rows that carry a usable number', async () => {
    const { fetchImpl } = capture(
      okJson({
        leads: [
          { email: 'a@x.com', phone: '+16477048645', created_at: '2026-09-09T00:00:00Z' },
          { email: 'b@x.com', phone: null, created_at: '2026-09-09T00:00:00Z' },
          { email: 'c@x.com', phone: '12345', created_at: '2026-09-09T00:00:00Z' },
        ],
      }),
    );
    const src = createLeadSource({ baseUrl: 'https://www.varritech.com', token: 'T0KEN', fetchImpl });

    const leads = await src.recent();

    expect(leads.map((l) => l.email)).toEqual(['a@x.com']);
  });

  /*
   * Same lesson as the OpenPhone read side: a body without the array must
   * throw, not report an empty list. "No leads today" and "the endpoint is
   * broken" look identical otherwise, and the broken one stays broken because
   * silence is the expected state most runs.
   */
  it('throws when the response carries no leads array', async () => {
    const { fetchImpl } = capture(okJson({ error: 'unauthorized' }));
    const src = createLeadSource({ baseUrl: 'https://www.varritech.com', token: 'T0KEN', fetchImpl });

    await expect(src.recent()).rejects.toThrow(/leads/i);
  });

  it('throws on a non-2xx rather than returning nothing', async () => {
    const { fetchImpl } = capture({ ok: false, status: 401, text: async () => 'nope' });
    const src = createLeadSource({ baseUrl: 'https://www.varritech.com', token: 'T0KEN', fetchImpl });

    await expect(src.recent()).rejects.toThrow(/401/);
  });
});
