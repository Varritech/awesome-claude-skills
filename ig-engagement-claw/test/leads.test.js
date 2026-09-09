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

const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86_400_000).toISOString();

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
          /*
           * Relative, not a literal date: the first touch now waits a day
           * after capture, so a hardcoded "today" made this pass or fail
           * depending on when it ran. This case is about the PHONE, so put
           * every row safely past the age floor.
           */
          { email: 'a@x.com', phone: '+16477048645', created_at: TWO_DAYS_AGO },
          { email: 'b@x.com', phone: null, created_at: TWO_DAYS_AGO },
          { email: 'c@x.com', phone: '12345', created_at: TWO_DAYS_AGO },
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

/*
 * The founder opener goes out ONE DAY after the pack, not the moment the row
 * appears (Cristiano, 2026-09-09). `recent({days})` is a lookback window only,
 * so without a floor the claw texts someone who is still reading the email it
 * is asking about — which reads as automated, which is the one thing this
 * message must not read as.
 */
describe('minimum age before the first touch', () => {
  const mk = (hoursAgo) => ({
    email: `l${hoursAgo}@example.com`,
    phone: '+16477048645',
    created_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  });

  const fetchWith = (leads) => async () => ({
    ok: true,
    json: async () => ({ leads }),
  });

  it('holds back a lead captured less than a day ago', async () => {
    const api = createLeadSource({ baseUrl: 'https://x', token: 't', fetchImpl: fetchWith([mk(2)]) });
    expect(await api.recent({ days: 14 })).toEqual([]);
  });

  it('releases a lead once a day has passed', async () => {
    const api = createLeadSource({ baseUrl: 'https://x', token: 't', fetchImpl: fetchWith([mk(25)]) });
    const out = await api.recent({ days: 14 });
    expect(out).toHaveLength(1);
    expect(out[0].phone).toBe('+16477048645');
  });

  it('still drops an implausible number, whatever its age', async () => {
    const api = createLeadSource({ baseUrl: 'https://x', token: 't', fetchImpl: fetchWith([{ ...mk(48), phone: '123' }]) });
    expect(await api.recent({ days: 14 })).toEqual([]);
  });
});
