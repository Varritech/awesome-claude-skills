import { describe, it, expect } from 'vitest';
import { draftReply, buildSalesPrompt } from '../src/sales.js';
import { CALENDLY_URL } from '../src/copy.js';

const lead = {
  slug: 'dana-whitfield', name: 'Dana Whitfield', headline: 'Owner, Whitfield HVAC',
  messages: [
    { from: 'us', text: 'Hi Dana, thanks for connecting...' },
    { from: 'them', text: 'Mostly scheduling and chasing quotes honestly. We are 14 people.' },
  ],
};
const llmSaying = (obj) => async () => (typeof obj === 'string' ? obj : JSON.stringify(obj));

describe('buildSalesPrompt', () => {
  it('carries the offer, the qualifier, the whole thread and who they are', () => {
    const p = buildSalesPrompt(lead);
    expect(p).toMatch(/full business bundle.*80%/i);
    expect(p).toMatch(/each claw.*replace an agency/i);
    expect(p).toMatch(/free/i);
    expect(p).toMatch(/only pay/i);
    expect(p).toMatch(/owner|decision/i);
    expect(p).toContain('Owner, Whitfield HVAC');
    expect(p).toContain('Mostly scheduling and chasing quotes');
  });
});

describe('draftReply', () => {
  it('sends the model reply, cleaned of em dashes', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: 'Got it — scheduling is a perfect fit. How many quotes a week?', qualified: null }) });
    expect(r).toMatchObject({ action: 'send', text: 'Got it, scheduling is a perfect fit. How many quotes a week?' });
  });

  it('strips calendar links: booking happens on his calendar, not a link', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: `Sounds like a fit. Grab a time: ${CALENDLY_URL}`, qualified: true }) });
    expect(r.text).not.toContain('calendly');
    expect(r.qualified).toBe(true);
  });

  it('strips any link that is not ours', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: 'See https://evil.example.com/x for details. Want to chat?', qualified: true }) });
    expect(r.text).not.toMatch(/evil/);
  });

  it('hands to Cristiano instead of sending when the model asks for a human', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: '', handoff: true, reason: 'asked for exact pricing' }) });
    expect(r).toMatchObject({ action: 'handoff', reason: 'asked for exact pricing' });
  });

  it('holds (sends nothing) on unparseable output, a placeholder, or a quoted price', async () => {
    expect((await draftReply({ lead, llm: llmSaying('sure thing!') })).action).toBe('hold');
    expect((await draftReply({ lead, llm: llmSaying({ reply: 'Hi [name], great.', qualified: null }) })).action).toBe('hold');
    const priced = await draftReply({ lead, llm: llmSaying({ reply: 'After the free build it is $2,500 a month.', qualified: true }) });
    expect(priced.action).toBe('handoff');
  });

  it('accepts a JSON object wrapped in prose or a code fence', async () => {
    const r = await draftReply({ lead, llm: llmSaying('```json\n{"reply":"How many quotes a week?","qualified":null}\n```') });
    expect(r).toMatchObject({ action: 'send', text: 'How many quotes a week?' });
  });
});

const slots = [
  { start: '2026-10-19T14:00:00.000Z', label: 'Mon Oct 19, 10:00 AM ET' },
  { start: '2026-10-20T18:30:00.000Z', label: 'Tue Oct 20, 2:30 PM ET' },
];
const agreed = {
  ...lead,
  messages: [
    ...lead.messages,
    { from: 'us', text: 'Want to map it on a quick call? I have Mon Oct 19, 10:00 AM ET or Tue Oct 20, 2:30 PM ET.' },
    { from: 'them', text: 'Tuesday works. dana@whitfieldhvac.com' },
  ],
};

describe('the sales brain', () => {
  it('sells like the closer rubric and carries real proof, never a client name', () => {
    const p = buildSalesPrompt(lead, { slots });
    expect(p).toMatch(/one question/i);
    expect(p).toMatch(/objection/i);
    expect(p).toMatch(/label/i);
    expect(p).toMatch(/case stud/i);
    expect(p).toMatch(/25-year marketing agency/);
    expect(p).not.toMatch(/IMP|Clearwater|VtMarkets|Social Growth Engine|Alix|KLT/);
  });

  it('offers only the real open slots, by label', () => {
    const p = buildSalesPrompt(lead, { slots });
    expect(p).toContain('S1 = Mon Oct 19, 10:00 AM ET');
    expect(p).toContain('S2 = Tue Oct 20, 2:30 PM ET');
    expect(p).toMatch(/email/i);
  });
});

describe('booking', () => {
  it('books the slot they picked with the email they typed', async () => {
    const r = await draftReply({ lead: agreed, slots, llm: llmSaying({ reply: 'Done.', qualified: true, book: { slot: 'S2', email: 'dana@whitfieldhvac.com' } }) });
    expect(r).toMatchObject({ action: 'book', start: '2026-10-20T18:30:00.000Z', email: 'dana@whitfieldhvac.com', qualified: true });
  });

  it('never books an email they did not write, a slot that is not open, or an unqualified lead', async () => {
    const invented = await draftReply({ lead: agreed, slots, llm: llmSaying({ reply: 'What is the best email for the invite?', qualified: true, book: { slot: 'S2', email: 'dana@whitfield.com' } }) });
    expect(invented).toMatchObject({ action: 'send', text: 'What is the best email for the invite?' });
    const noSlot = await draftReply({ lead: agreed, slots, llm: llmSaying({ reply: 'Which works?', qualified: true, book: { slot: 'S9', email: 'dana@whitfieldhvac.com' } }) });
    expect(noSlot.action).toBe('send');
    const unq = await draftReply({ lead: agreed, slots, llm: llmSaying({ reply: 'Which works?', qualified: false, book: { slot: 'S2', email: 'dana@whitfieldhvac.com' } }) });
    expect(unq.action).toBe('send');
  });
});
