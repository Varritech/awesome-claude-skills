/*
 * The SMS concierge. This is the first thing in this repo that texts a real
 * phone number, so the tests are mostly about what it must REFUSE to do.
 *
 * The people here are not cold: every one of them typed their number into the
 * landing page to get the free 5-skill pack. That consent is exactly as wide as
 * it sounds, which is why STOP is absolute and why nobody who did not ask can
 * ever end up in a batch.
 */
import { describe, it, expect } from 'vitest';
import {
  planFirstTouch,
  classifyInbound,
  firstTouchText,
  draftReply,
  buildReplyPrompt,
} from '../src/sms.js';

const lead = (over = {}) => ({
  phone: '+16477048645',
  email: 'buyer@agency.com',
  created_at: '2026-09-09T12:00:00.000Z',
  ...over,
});

function fakeLedger(entries = []) {
  const map = new Map(entries.map((e) => [e.handle, e]));
  return {
    has: (h) => map.has(h),
    all: () => [...map.values()],
    sentSince: () => 0,
    record: (h, meta) => map.set(h, { handle: h, ...meta }),
    recordFollowUp: () => {},
    markReplied: () => {},
    markBlocked: () => {},
    size: () => map.size,
  };
}

const NOON_ET = new Date('2026-09-09T16:00:00.000Z'); // 12:00 America/New_York

describe('planFirstTouch — who gets a text at all', () => {
  it('texts a lead who asked for the pack and has not been texted yet', () => {
    const plan = planFirstTouch({ leads: [lead()], ledger: fakeLedger(), now: NOON_ET });
    expect(plan.map((p) => p.phone)).toEqual(['+16477048645']);
  });

  it('never texts the same number twice', () => {
    const ledger = fakeLedger([{ handle: '+16477048645', at: '2026-09-09T13:00:00.000Z' }]);
    const plan = planFirstTouch({ leads: [lead()], ledger, now: NOON_ET });
    expect(plan).toEqual([]);
  });

  it('never texts a lead with no phone on the row', () => {
    const plan = planFirstTouch({ leads: [lead({ phone: null })], ledger: fakeLedger(), now: NOON_ET });
    expect(plan).toEqual([]);
  });

  it('never texts a number that opted out, even if it is not in the ledger as sent', () => {
    const ledger = fakeLedger([
      { handle: '+16477048645', status: 'opted-out', at: '2026-09-08T13:00:00.000Z' },
    ]);
    const plan = planFirstTouch({ leads: [lead()], ledger, now: NOON_ET });
    expect(plan).toEqual([]);
  });

  it('never texts a number that is not a plausible E.164 string', () => {
    const plan = planFirstTouch({ leads: [lead({ phone: '12345' })], ledger: fakeLedger(), now: NOON_ET });
    expect(plan).toEqual([]);
  });

  /*
   * Quiet hours are not politeness, they are the law. An automated text at
   * 3am is the single most reportable thing this could do. The window is
   * deliberately narrower than the legal 8am-9pm.
   */
  it('sends nothing outside the send window', () => {
    const threeAmEt = new Date('2026-09-09T07:00:00.000Z');
    const plan = planFirstTouch({ leads: [lead()], ledger: fakeLedger(), now: threeAmEt });
    expect(plan).toEqual([]);
  });

  it('holds everything when the kill switch is on', () => {
    const plan = planFirstTouch({ leads: [lead()], ledger: fakeLedger(), now: NOON_ET, killSwitch: true });
    expect(plan).toEqual([]);
  });

  it('respects the per-run cap', () => {
    const leads = ['+16477048645', '+16477048646', '+16477048647'].map((phone) => lead({ phone }));
    const plan = planFirstTouch({ leads, ledger: fakeLedger(), now: NOON_ET, cap: 2 });
    expect(plan).toHaveLength(2);
  });

  it('respects the hourly budget already spent', () => {
    const ledger = fakeLedger();
    ledger.sentSince = () => 4;
    const plan = planFirstTouch({
      leads: [lead()],
      ledger,
      now: NOON_ET,
      rate: { perHour: 4, perDay: 30 },
    });
    expect(plan).toEqual([]);
  });

  it('takes the oldest lead first, so nobody waits forever behind fresh signups', () => {
    const leads = [
      lead({ phone: '+16477048646', created_at: '2026-09-09T15:00:00.000Z' }),
      lead({ phone: '+16477048645', created_at: '2026-09-08T15:00:00.000Z' }),
    ];
    const plan = planFirstTouch({ leads, ledger: fakeLedger(), now: NOON_ET, cap: 1 });
    expect(plan[0].phone).toBe('+16477048645');
  });
});

describe('classifyInbound — STOP is absolute', () => {
  it.each(['STOP', 'stop', 'Stop.', 'UNSUBSCRIBE', 'please stop texting me', 'QUIT'])(
    'treats %s as an opt out',
    (text) => {
      expect(classifyInbound(text)).toBe('stop');
    },
  );

  it('does not read a question containing the word stop as an opt out', () => {
    expect(classifyInbound('does it stop working after a year?')).toBe('question');
  });

  it('treats anything else as a question to answer', () => {
    expect(classifyInbound('what is actually in the pack')).toBe('question');
  });
});

describe('firstTouchText — the one message we write ourselves', () => {
  const text = firstTouchText(lead());

  it('says who it is, because an unknown number texting you is a stranger', () => {
    expect(text).toMatch(/Cristiano/);
    expect(text).toMatch(/Varritech/i);
  });

  it('references the thing they actually asked for', () => {
    expect(text).toMatch(/skills/i);
  });

  it('ends the message itself on "what are you building", which is how he opens every sale', () => {
    // The opt-out footer is a compliance line bolted on the end; the message
    // has to still land on the question.
    const body = text.split(/\n\n/)[0].trim();
    expect(body).toMatch(/what are you building\?$/i);
  });

  it('tells them how to stop', () => {
    expect(text).toMatch(/STOP/);
  });

  it('quotes no price and no em dash', () => {
    expect(text).not.toMatch(/\$/);
    expect(text).not.toContain('—');
  });
});

describe('draftReply — the model writes it, the guards decide if it ships', () => {
  const thread = [
    { direction: 'outgoing', text: 'Hey, Cristiano here.' },
    { direction: 'incoming', text: 'is this worth it for a marketing agency' },
  ];

  it('returns the model text when it is clean', async () => {
    const llm = async () => 'Depends what you run. What are you building?';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe(
      'Depends what you run. What are you building?',
    );
  });

  it('drops a draft that invents a price', async () => {
    const llm = async () => 'I can do $37 for you today.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });

  it('drops a draft that attaches the Premium price to the plain vault', async () => {
    const llm = async () => 'The full library is $999 one time.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });

  it('drops a draft that promises a discount we do not give', async () => {
    const llm = async () => 'I can get you a discount code for that.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });

  it('strips an em dash rather than dropping the whole reply', async () => {
    const llm = async () => 'Got it — the premium set is the one.';
    const out = await draftReply({ thread, lead: lead(), llm });
    expect(out).not.toContain('—');
    expect(out).toMatch(/premium set/);
  });

  it('drops a draft that still has a placeholder in it', async () => {
    const llm = async () => 'Hey [name], the premium set is the one.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });

  it('keeps it text-length, because he sends short messages', async () => {
    const llm = async () => 'word '.repeat(120);
    const out = await draftReply({ thread, lead: lead(), llm });
    expect(out.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(60);
  });

  it('says nothing at all when the model returns nothing, rather than sending a filler line', async () => {
    const llm = async () => '   ';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });
});

describe('buildReplyPrompt — the model can only see what we know', () => {
  const prompt = buildReplyPrompt({
    thread: [{ direction: 'incoming', text: 'what is in it' }],
    lead: lead(),
  });

  it('carries the live catalogue and prices', () => {
    expect(prompt).toMatch(/268/);
    expect(prompt).toContain('$299');
    expect(prompt).toContain('$999');
  });

  it('carries what we have sold before, so the answers come from real deals', () => {
    expect(prompt).toMatch(/marketing agency/i);
    expect(prompt).toMatch(/refund/i);
  });

  it('carries the voice rules, including the no-discount rule', () => {
    expect(prompt).toMatch(/no discounts/i);
    expect(prompt).toMatch(/founder/i);
  });

  it('includes the conversation so far', () => {
    expect(prompt).toContain('what is in it');
  });
});

describe('buildReplyPrompt — it sells by the framework, not by pitching', () => {
  const prompt = buildReplyPrompt({
    thread: [{ direction: 'incoming', text: 'yeah this is her, who is this' }],
    lead: lead(),
  });

  it('forbids pitching before they have named a problem', () => {
    expect(prompt).toMatch(/do not pitch/i);
    expect(prompt).toMatch(/until they have told you (a|the) problem/i);
  });

  it('asks one discovery question at a time and answers theirs first', () => {
    expect(prompt).toMatch(/answer their question first/i);
    expect(prompt).toMatch(/one question per text/i);
  });

  it('handles objections with a question before an answer', () => {
    expect(prompt).toMatch(/objection.*question first/i);
  });

  it('only asks for the call after a pain is named, and sends the link only after they pick a time', () => {
    expect(prompt).toMatch(/two time slots/i);
    expect(prompt).toMatch(/link only after they pick/i);
  });
});

describe('buildReplyPrompt — the AI Workforce is the offer it leads with', () => {
  const prompt = buildReplyPrompt({ thread: [{ direction: 'incoming', text: 'what do you do' }], lead: lead() });

  it('carries the AI Workforce package and its real prices', () => {
    expect(prompt).toMatch(/AI Workforce/);
    expect(prompt).toContain('$7,999');
    expect(prompt).toContain('$6,799');
    expect(prompt).toContain('$799');
  });

  it('carries the three proof points, the hotel one as in progress, not a result', () => {
    expect(prompt).toMatch(/200 retail clients/);
    expect(prompt).toMatch(/social growth agency/i);
    expect(prompt).toMatch(/hotel chain/i);
    expect(prompt).toMatch(/building (it )?now/i);
  });

  it('never names the clients behind the proof', () => {
    expect(prompt).not.toMatch(/Lucas|Philipp|IMP Canada|Interactive Media|Social Growth Engine/);
  });
});

describe('draftReply — AI Workforce prices get through, invented ones still do not', () => {
  const thread = [{ direction: 'incoming', text: 'ok what does that cost' }];

  it('ships the real workforce price when they asked for it', async () => {
    const llm = async () => 'The AI Workforce is $7,999 for up to ten agents, or $6,799 if signed by Wed 30 Sep.';
    expect(await draftReply({ thread, lead: lead(), llm })).toMatch(/\$7,999/);
  });

  it('ships the maintenance price', async () => {
    const llm = async () => 'Maintenance on the workforce is optional, $799 a month.';
    expect(await draftReply({ thread, lead: lead(), llm })).toMatch(/\$799/);
  });

  it('still drops a made-up workforce price', async () => {
    const llm = async () => 'The AI Workforce is $4,999 for ten agents.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });

  it('still drops the $299 add-on price pinned on the workforce', async () => {
    const llm = async () => 'The AI Workforce agents are $299.';
    expect(await draftReply({ thread, lead: lead(), llm })).toBe('');
  });
});
