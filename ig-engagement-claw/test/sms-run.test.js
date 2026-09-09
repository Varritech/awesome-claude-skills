/*
 * One tick of the SMS concierge, end to end, with every seam faked.
 *
 * The ordering matters and is asserted: someone who has already texted us and
 * is sitting there waiting gets answered BEFORE we go and introduce ourselves
 * to a stranger. Getting that backwards is how a live conversation goes cold
 * while the claw is busy starting new ones.
 */
import { describe, it, expect } from 'vitest';
import { smsTick } from '../src/sms-run.js';

const NOON_ET = new Date('2026-09-09T16:00:00.000Z');

function fakeLedger(entries = []) {
  const map = new Map(entries.map((e) => [e.handle, { ...e }]));
  return {
    _map: map,
    has: (h) => map.has(h),
    all: () => [...map.values()],
    sentSince: () => 0,
    record: (h, meta) => map.set(h, { handle: h, ...meta }),
    recordFollowUp: (h, f) => {
      const e = map.get(h);
      e.followUps = [...(e.followUps ?? []), f];
    },
    markReplied: (h) => {
      const e = map.get(h);
      if (e) e.replied = true;
    },
    markBlocked: () => {},
    size: () => map.size,
  };
}

function fakeQuo(threads = {}) {
  const sent = [];
  return {
    sent,
    from: '+13658250303',
    send: async ({ to, text }) => {
      sent.push({ to, text });
      return { id: 'AC1' };
    },
    thread: async (p) => threads[p] ?? [],
  };
}

const leadSource = (leads) => ({ recent: async () => leads });

describe('smsTick — nothing happens unless it is switched on', () => {
  it('sends nothing when SMS is not enabled, and says so', async () => {
    const quo = fakeQuo();
    const report = await smsTick({
      enabled: false,
      leadSource: leadSource([{ phone: '+16477048645', email: 'a@x.com', created_at: '2026-09-08T00:00:00Z' }]),
      quo,
      ledger: fakeLedger(),
      llm: async () => 'hi',
      now: NOON_ET,
    });

    expect(quo.sent).toEqual([]);
    expect(report.enabled).toBe(false);
  });
});

describe('smsTick — first touch', () => {
  it('texts a new lead the fixed opener and records it', async () => {
    const quo = fakeQuo();
    const ledger = fakeLedger();
    await smsTick({
      enabled: true,
      leadSource: leadSource([{ phone: '+16477048645', email: 'a@x.com', created_at: '2026-09-08T00:00:00Z' }]),
      quo,
      ledger,
      llm: async () => 'should not be used',
      now: NOON_ET,
    });

    expect(quo.sent).toHaveLength(1);
    expect(quo.sent[0].to).toBe('+16477048645');
    expect(quo.sent[0].text).toMatch(/Cristiano/);
    expect(ledger.has('+16477048645')).toBe(true);
  });

  it('does not record a send that threw, so it is retried next run', async () => {
    const quo = fakeQuo();
    quo.send = async () => {
      throw new Error('openphone send 402: no credit');
    };
    const ledger = fakeLedger();

    const report = await smsTick({
      enabled: true,
      leadSource: leadSource([{ phone: '+16477048645', email: 'a@x.com', created_at: '2026-09-08T00:00:00Z' }]),
      quo,
      ledger,
      llm: async () => 'x',
      now: NOON_ET,
    });

    expect(ledger.has('+16477048645')).toBe(false);
    expect(report.errors).toHaveLength(1);
  });
});

describe('smsTick — answering what they asked', () => {
  const texted = () => fakeLedger([{ handle: '+16477048645', at: '2026-09-09T14:00:00.000Z' }]);

  it('replies when their message is the newest thing in the thread', async () => {
    const quo = fakeQuo({
      '+16477048645': [
        { id: '1', direction: 'outgoing', text: 'Hey, this is Cristiano', createdAt: '2026-09-09T14:00:00Z' },
        { id: '2', direction: 'incoming', text: 'what is actually in it', createdAt: '2026-09-09T15:00:00Z' },
      ],
    });
    const ledger = texted();

    await smsTick({
      enabled: true,
      leadSource: leadSource([]),
      quo,
      ledger,
      llm: async () => 'Six departments, 268 of them. What do you run?',
      now: NOON_ET,
    });

    expect(quo.sent).toHaveLength(1);
    expect(quo.sent[0].text).toMatch(/268/);
    expect(ledger.all()[0].followUps).toHaveLength(1);
  });

  it('stays quiet when the newest message is already ours', async () => {
    const quo = fakeQuo({
      '+16477048645': [
        { id: '1', direction: 'incoming', text: 'what is in it', createdAt: '2026-09-09T14:00:00Z' },
        { id: '2', direction: 'outgoing', text: 'Six departments.', createdAt: '2026-09-09T15:00:00Z' },
      ],
    });

    await smsTick({
      enabled: true,
      leadSource: leadSource([]),
      quo,
      ledger: texted(),
      llm: async () => 'should not be used',
      now: NOON_ET,
    });

    expect(quo.sent).toEqual([]);
  });

  it('sends nothing when the guards reject the draft, rather than sending something safe-sounding', async () => {
    const quo = fakeQuo({
      '+16477048645': [
        { id: '1', direction: 'incoming', text: 'can I get a discount', createdAt: '2026-09-09T15:00:00Z' },
      ],
    });

    const report = await smsTick({
      enabled: true,
      leadSource: leadSource([]),
      quo,
      ledger: texted(),
      llm: async () => 'Sure, I can get you a discount code.',
      now: NOON_ET,
    });

    expect(quo.sent).toEqual([]);
    expect(report.held).toBe(1);
  });

  /*
   * A reply to someone who just texted us is not a marketing blast, so it is
   * not held for the quiet-hours window. Ignoring a person until 9am because
   * they wrote at 8:40pm is worse behaviour than answering them.
   */
  it('answers a live question outside the cold-send window', async () => {
    const elevenPmEt = new Date('2026-09-10T03:00:00.000Z');
    const quo = fakeQuo({
      '+16477048645': [{ id: '1', direction: 'incoming', text: 'still there?', createdAt: '2026-09-10T02:55:00Z' }],
    });

    await smsTick({
      enabled: true,
      leadSource: leadSource([{ phone: '+16477049999', email: 'b@x.com', created_at: '2026-09-08T00:00:00Z' }]),
      quo,
      ledger: texted(),
      llm: async () => 'Yeah I am here. What are you building?',
      now: elevenPmEt,
    });

    // The reply went. The cold first touch to the OTHER number did not.
    expect(quo.sent.map((s) => s.to)).toEqual(['+16477048645']);
  });
});

describe('smsTick — STOP', () => {
  it('opts them out, sends nothing back, and never plans them again', async () => {
    const quo = fakeQuo({
      '+16477048645': [{ id: '1', direction: 'incoming', text: 'STOP', createdAt: '2026-09-09T15:00:00Z' }],
    });
    const ledger = fakeLedger([{ handle: '+16477048645', at: '2026-09-09T14:00:00.000Z' }]);

    const report = await smsTick({
      enabled: true,
      leadSource: leadSource([]),
      quo,
      ledger,
      llm: async () => 'sure thing',
      now: NOON_ET,
    });

    // ⛔ Not even a "no problem, you are unsubscribed" — that is one more
    // unwanted text to somebody who just told us to stop.
    expect(quo.sent).toEqual([]);
    expect(ledger.all()[0].status).toBe('opted-out');
    expect(report.optedOut).toBe(1);
  });

  it('leaves an opted-out number alone on every later run', async () => {
    const quo = fakeQuo({
      '+16477048645': [{ id: '2', direction: 'incoming', text: 'actually what is in it', createdAt: '2026-09-09T15:00:00Z' }],
    });
    const ledger = fakeLedger([
      { handle: '+16477048645', at: '2026-09-09T14:00:00.000Z', status: 'opted-out' },
    ]);

    await smsTick({
      enabled: true,
      leadSource: leadSource([]),
      quo,
      ledger,
      llm: async () => 'here you go',
      now: NOON_ET,
    });

    expect(quo.sent).toEqual([]);
  });
});
