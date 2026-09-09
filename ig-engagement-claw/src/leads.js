/**
 * The capture rows the SMS concierge follows up on.
 *
 * ⛔ Read through an authenticated endpoint on the site, never a direct
 * Supabase connection. The service-role key writes every table in the
 * production database; there is no version of "a claw on a laptop holds it"
 * that is worth saving one HTTP hop. The endpoint returns capture rows and
 * nothing else, so the blast radius of this token leaking is a list of people
 * who asked for a free download.
 */

import { isPlausiblePhone } from './sms.js';

export function createLeadSource({ baseUrl, token, fetchImpl = fetch }) {
  if (!baseUrl) throw new Error('createLeadSource: baseUrl is required');
  if (!token) throw new Error('createLeadSource: token is required');

  return {
    /**
     * Capture rows from the last `days`, newest or oldest order unspecified —
     * `planFirstTouch` sorts them itself.
     */
    async recent({ days = 14 } = {}) {
      const res = await fetchImpl(`${baseUrl}/api/nurture/sms-queue?days=${days}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`sms-queue ${res.status}: ${await res.text()}`);

      const body = await res.json();
      // ⛔ Never fall back to []. "No leads today" is the expected state on most
      // runs, so a broken endpoint that returns an empty list is invisible
      // forever. Same failure the OpenPhone read side produced once already.
      if (!Array.isArray(body?.leads)) {
        throw new Error(`sms-queue: response carried no leads array: ${JSON.stringify(body).slice(0, 200)}`);
      }

      return body.leads.filter((l) => isPlausiblePhone(l?.phone));
    },
  };
}
