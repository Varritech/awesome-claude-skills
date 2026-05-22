import { describe, it, expect } from 'vitest';
import { buildEmailPrompt, PERSONA_FRAMEWORK_MAP } from './prompt-builder';
import type { EmailPromptInput } from './prompt-builder';

const BASE_INPUT: EmailPromptInput = {
  emailNumber: 1,
  ragChunks: [],
  tokens: {
    first_name: 'Mike',
    company: 'Sunrise Roofing',
    city: 'Tampa',
    industry: 'roofing',
    pain_signal: 'noticed you have few reviews',
    case_study_result: 'cut $2,400/mo from lead gen',
    outcome_metric: '3–5 booked jobs/month',
    cta_ask: 'Would you mind if I sent over 2 times we could talk?',
    sender_name: 'Jake',
  },
  prospect: { firstName: 'Mike', company: 'Sunrise Roofing', industry: 'roofing', city: 'Tampa' },
  campaign: { senderName: 'Jake', businessName: "Jake's Roofing", niche: 'roofing', offer: 'cold email system' },
};

describe('PERSONA_FRAMEWORK_MAP', () => {
  it('maps closer to andy_elliott', () => {
    expect(PERSONA_FRAMEWORK_MAP['closer']).toBe('andy_elliott');
  });

  it('maps neighbor to belfort', () => {
    expect(PERSONA_FRAMEWORK_MAP['neighbor']).toBe('belfort');
  });

  it('maps expert to hormozi', () => {
    expect(PERSONA_FRAMEWORK_MAP['expert']).toBe('hormozi');
  });

  it('maps helper to sam_ovens', () => {
    expect(PERSONA_FRAMEWORK_MAP['helper']).toBe('sam_ovens');
  });
});

describe('buildEmailPrompt — persona framework injection', () => {
  it('includes Andy Elliott tone instruction when personaId is closer', () => {
    const prompt = buildEmailPrompt({ ...BASE_INPUT, personaId: 'closer' });
    expect(prompt).toContain('Andy Elliott');
  });

  it('includes Belfort tone instruction when personaId is neighbor', () => {
    const prompt = buildEmailPrompt({ ...BASE_INPUT, personaId: 'neighbor' });
    expect(prompt).toContain('Belfort');
  });

  it('includes Hormozi tone instruction when personaId is expert', () => {
    const prompt = buildEmailPrompt({ ...BASE_INPUT, personaId: 'expert' });
    expect(prompt).toContain('Hormozi');
  });

  it('includes Sam Ovens tone instruction when personaId is helper', () => {
    const prompt = buildEmailPrompt({ ...BASE_INPUT, personaId: 'helper' });
    expect(prompt).toContain('Sam Ovens');
  });

  it('omits persona tone section when no personaId given', () => {
    const prompt = buildEmailPrompt(BASE_INPUT);
    expect(prompt).not.toContain('PERSONA TONE');
  });

  it('unknown personaId does not crash and omits persona tone section', () => {
    const prompt = buildEmailPrompt({ ...BASE_INPUT, personaId: 'nonexistent' });
    expect(prompt).not.toContain('PERSONA TONE');
  });
});

describe('retrieveForEmail — framework filter from persona', () => {
  // Tested via integration in retriever.test.ts — covered there.
  it('PERSONA_FRAMEWORK_MAP covers all four built-in persona IDs', () => {
    const builtIns = ['closer', 'neighbor', 'expert', 'helper'];
    for (const id of builtIns) {
      expect(PERSONA_FRAMEWORK_MAP[id]).toBeDefined();
    }
  });
});
