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
    expect(p).toMatch(/up to 80%/);
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

  it('strips the calendar link until the lead is qualified', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: `Happy to show you. Grab a time: ${CALENDLY_URL}`, qualified: false }) });
    expect(r.text).not.toContain('calendly');
  });

  it('keeps the calendar link once qualified, and marks the lead qualified', async () => {
    const r = await draftReply({ lead, llm: llmSaying({ reply: `Sounds like a fit. Grab a time here: ${CALENDLY_URL}`, qualified: true }) });
    expect(r.text).toContain(CALENDLY_URL);
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
