/*
 * Quo is OpenPhone under the hood. Two API details here have already cost a
 * full session each, so they are pinned rather than remembered:
 *   - the Authorization header takes the RAW key, never "Bearer <key>";
 *   - the read side takes `participants=+1...` with NO brackets. Both
 *     `participants[]=` and the encoded `participants%5B%5D=` now hard-400
 *     with "/participants: Expected array", and the 400 body has no `data`
 *     key, so counting with `data.length` prints a confident 0 that reads
 *     exactly like an empty thread. 217 conversations were once declared
 *     "no SMS on this account" that way while one thread held 1,356 messages.
 */
import { describe, it, expect } from 'vitest';
import { createQuo } from '../src/quo.js';

const okJson = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

function capture(response = okJson({ data: [] })) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response(url, init) : response;
  };
  return { calls, fetchImpl };
}

describe('createQuo — sending', () => {
  it('posts the message with the raw key, never a Bearer prefix', async () => {
    const { calls, fetchImpl } = capture(okJson({ data: { id: 'AC1' } }));
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await quo.send({ to: '+16477048645', text: 'hey man' });

    expect(calls[0].url).toBe('https://api.openphone.com/v1/messages');
    expect(calls[0].init.headers.Authorization).toBe('KEY123');
    expect(calls[0].init.headers.Authorization).not.toMatch(/^Bearer/);
    expect(JSON.parse(calls[0].init.body)).toEqual({
      content: 'hey man',
      from: '+13658250303',
      to: ['+16477048645'],
    });
  });

  it('throws on a non-2xx so a failed send is never recorded as sent', async () => {
    const { fetchImpl } = capture({ ok: false, status: 402, text: async () => 'no credit' });
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await expect(quo.send({ to: '+16477048645', text: 'hey' })).rejects.toThrow(/402/);
  });

  it('refuses to send an empty message rather than posting a blank text', async () => {
    const { calls, fetchImpl } = capture();
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await expect(quo.send({ to: '+16477048645', text: '   ' })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('createQuo — reading a thread', () => {
  it('asks for participants with no brackets', async () => {
    const { calls, fetchImpl } = capture(okJson({ data: [] }));
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await quo.thread('+16477048645');

    const url = calls[0].url;
    expect(url).toContain('participants=%2B16477048645');
    expect(url).not.toContain('%5B%5D');
    expect(url).not.toContain('participants[]');
  });

  it('returns messages newest-last, with direction and text', async () => {
    const { fetchImpl } = capture(
      okJson({
        data: [
          { id: 'b', direction: 'outgoing', text: 'hey man', createdAt: '2026-09-09T10:00:00Z' },
          { id: 'a', direction: 'incoming', text: 'what is in it', createdAt: '2026-09-09T09:00:00Z' },
        ],
      }),
    );
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    const msgs = await quo.thread('+16477048645');

    expect(msgs.map((m) => m.id)).toEqual(['a', 'b']);
    expect(msgs[0]).toMatchObject({ direction: 'incoming', text: 'what is in it' });
  });

  /*
   * The failure that produced a whole-session false negative: a 400 body has
   * no `data` key at all, so anything that reaches for `.data.length` reports
   * an empty thread instead of an error.
   */
  it('throws on an error response instead of reporting an empty thread', async () => {
    const { fetchImpl } = capture({
      ok: false,
      status: 400,
      text: async () => '{"message":"/participants: Expected array"}',
    });
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await expect(quo.thread('+16477048645')).rejects.toThrow(/400/);
  });

  it('treats a 200 with no data key as an error, not as silence', async () => {
    const { fetchImpl } = capture(okJson({ message: 'something else' }));
    const quo = createQuo({ apiKey: 'KEY123', from: '+13658250303', fetchImpl });

    await expect(quo.thread('+16477048645')).rejects.toThrow(/data/i);
  });
});
