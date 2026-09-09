/**
 * Quo (OpenPhone) SMS seam. Injected everywhere else so tests never text a
 * real person.
 *
 * ⛔ Two API details that have each cost a full session:
 *
 * 1. `Authorization` takes the RAW key. Not `Bearer <key>`. A Bearer prefix
 *    401s with a message that reads like a bad key.
 *
 * 2. The read side wants `participants=+1...` with NO brackets. Both
 *    `participants[]=` and `participants%5B%5D=` now hard-400 with
 *    `/participants: Expected array`, and the 400 body carries no `data` key.
 *    Anything that counts with `d.get('data', []).length` therefore prints a
 *    confident 0 that is indistinguishable from an empty thread. That is how
 *    217 conversations were once declared "no SMS on this account" while a
 *    single thread held 1,356 messages. Every non-2xx throws here, and so does
 *    a 200 whose body has no `data` array.
 */

const API = 'https://api.openphone.com/v1';

export function createQuo({ apiKey, from, phoneNumberId, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('createQuo: QUO_API_KEY is required');
  if (!from) throw new Error('createQuo: a sending number is required');

  const headers = { Authorization: apiKey, 'content-type': 'application/json' };

  return {
    from,

    /** Send one text. Throws on anything that is not a clean 2xx. */
    async send({ to, text }) {
      const content = String(text ?? '').trim();
      // A blank send still costs a segment, still shows up in their thread as
      // a message from us, and tells them nothing. Refuse before the network.
      if (!content) throw new Error('quo.send: refusing to send an empty message');
      if (!to) throw new Error('quo.send: no recipient');

      const res = await fetchImpl(`${API}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, from, to: [to] }),
      });
      if (!res.ok) throw new Error(`openphone send ${res.status}: ${await res.text()}`);
      return res.json();
    },

    /**
     * The whole conversation with one number, oldest first.
     *
     * Oldest-first because that is the order a model needs to read it in; the
     * API returns newest-first.
     */
    async thread(participant, { limit = 50 } = {}) {
      const qs = new URLSearchParams({ participants: participant, maxResults: String(limit) });
      if (phoneNumberId) qs.set('phoneNumberId', phoneNumberId);

      const res = await fetchImpl(`${API}/messages?${qs.toString()}`, { headers });
      if (!res.ok) throw new Error(`openphone thread ${res.status}: ${await res.text()}`);

      const body = await res.json();
      if (!Array.isArray(body?.data)) {
        throw new Error(`openphone thread: response had no data array: ${JSON.stringify(body).slice(0, 200)}`);
      }
      return [...body.data].reverse();
    },
  };
}

/** An inbound message from them, as opposed to one of ours. */
export const isInbound = (m) => m?.direction === 'incoming';
