/*
 * The runner prompt carries a human-readable copy of the offer table, because
 * the browser agent reads that file and not src/offers.js. Two copies of a
 * price is exactly how a claw ends up quoting a number the landing page
 * retired weeks ago, so this pins the doc to the module.
 *
 * It asserts the numbers, not the prose. Rewording the section is fine;
 * disagreeing with the catalogue is not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { OFFERS, KNOWN_PRICES } from '../src/offers.js';

const prompt = readFileSync(new URL('../runner-prompt.md', import.meta.url), 'utf8');

describe('runner-prompt.md offer memory', () => {
  it('exists at all', () => {
    expect(prompt).toMatch(/## Offer memory/);
  });

  it('points the agent at src/offers.js as the source of truth', () => {
    expect(prompt).toMatch(/src\/offers\.js/);
  });

  it('quotes every live price and no other dollar figure', () => {
    const section = prompt.split('## Offer memory')[1].split('\n## ')[0];
    const quoted = new Set(
      (section.match(/\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?/g) ?? []).map((p) => p.replace(/[$,\s]/g, '')),
    );
    // Retired figures are named in the section on purpose, as a do-not-use
    // list. They are the only ones allowed besides the live prices.
    // '15' is what the regex sees in "$15k".
    const retired = new Set(['97', '299', '999', '149.99', '15']);
    const live = new Set(KNOWN_PRICES.map((p) => p.replace(/[$,]/g, '')));

    for (const price of live) expect(section).toContain(`$${price}`);
    for (const q of quoted) expect(live.has(q) || retired.has(q)).toBe(true);
  });

  it('quotes the live catalogue size', () => {
    const premium = OFFERS.find((o) => o.id === 'skills-premium');
    const size = premium.summary.match(/\b(\d{3})\b/)[1];
    expect(prompt).toContain(`${size} skills`);
  });

  it('names the five skills the free pack actually ships', () => {
    const free = OFFERS.find((o) => o.id === 'skills-free-pack');
    for (const skill of free.summary.match(/[a-z-]+-[a-z-]+/g).filter((s) => s.includes('-'))) {
      if (skill.length < 8) continue;
      expect(prompt).toContain(skill);
    }
  });

  it('carries the no-discount rule, which is the objection we get most', () => {
    expect(prompt).toMatch(/No discounts/i);
  });

  it('names the retired numbers so a stale draft is recognisable', () => {
    for (const dead of ['170', '$97', '$999']) {
      expect(prompt).toContain(dead);
    }
  });
});
