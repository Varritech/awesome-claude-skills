/*
 * The offer memory is what stops the SMS concierge inventing an offer.
 *
 * Every real defect this file exists to prevent has already happened once: the
 * sales claw argued "268 isn't a number we quote" at a prospect who had just
 * read the page, and a WhatsApp thread quoted $299/$97 weeks after the page
 * moved to $47/$197. So the catalogue is asserted against the live page, not
 * against prose.
 */
import { describe, it, expect } from 'vitest';
import {
  OFFERS,
  PAST_SALES,
  VOICE,
  offerBriefing,
  quotesOnlyKnownPrices,
  misattributesVaultPrice,
} from '../src/offers.js';

describe('what we are currently offering', () => {
  it('carries the two live Skills tiers at their live prices', () => {
    const essential = OFFERS.find((o) => o.id === 'skills-essential');
    const premium = OFFERS.find((o) => o.id === 'skills-premium');
    expect(essential.price).toBe('$47');
    expect(premium.price).toBe('$197');
    expect(premium.summary).toMatch(/268/);
  });

  it('keeps the AI Employee Pack as a separate paid add-on, not part of the vault', () => {
    const addon = OFFERS.find((o) => o.id === 'ai-employee-pack');
    expect(addon.price).toBe('$299');
    expect(addon.kind).toBe('addon');
    // ⛔ PR #483: autonomous agents are NOT in the $47/$197 buy. Claiming they
    // are is the exact thing that got stripped off six surfaces of the LP.
    const vault = OFFERS.find((o) => o.id === 'skills-premium');
    expect(`${vault.summary} ${vault.includes.join(' ')}`).not.toMatch(/autonomous agent/i);
  });

  it('names all three guarantees, because they are the close', () => {
    const brief = offerBriefing();
    expect(brief).toMatch(/72-Hour Takeover/i);
    expect(brief).toMatch(/First-Hire/i);
    expect(brief).toMatch(/48-hour/i);
  });

  it('quotes no retired price anywhere', () => {
    const brief = offerBriefing();
    for (const dead of ['$97', '$999', '$129', '$149.99', '$15k', '$15,000']) {
      expect(brief).not.toContain(dead);
    }
  });

  it('quotes no retired catalogue size', () => {
    const brief = offerBriefing();
    expect(brief).not.toMatch(/\b(170|213|191|253|137)\b/);
    expect(brief).toMatch(/\b268\b/);
  });

  it('never promises a discount, because we do not do them', () => {
    expect(offerBriefing()).toMatch(/no discounts/i);
  });
});

describe('what we have sold in the past', () => {
  it('records the real closed deals, including the one that refunded', () => {
    const ids = PAST_SALES.map((s) => s.id);
    expect(ids).toContain('black-stag-digital');
    expect(ids).toContain('nayyar-samad-refund');
    expect(ids).toContain('john-milo-insurance');
  });

  it('keeps the refund and what caused it, not just the wins', () => {
    const refund = PAST_SALES.find((s) => s.id === 'nayyar-samad-refund');
    expect(refund.outcome).toMatch(/refund/i);
    expect(refund.lesson).toBeTruthy();
  });

  it('carries the objections we have actually been hit with', () => {
    const brief = offerBriefing();
    expect(brief).toMatch(/discount/i);
    expect(brief).toMatch(/fast movers/i);
  });
});

describe('the voice', () => {
  it('is Cristiano, the founder, not a support bot', () => {
    expect(VOICE).toMatch(/founder/i);
    expect(VOICE).toMatch(/Cristiano/);
  });

  it('bans em dashes, which he never uses', () => {
    expect(VOICE).toMatch(/em dash/i);
    expect(offerBriefing()).not.toContain('—');
  });

  it('leads with qualifying before recommending, the way he actually opens', () => {
    expect(VOICE).toMatch(/what you.{0,3}re building/i);
  });
});

describe('quotesOnlyKnownPrices — the guard on anything the model writes', () => {
  it('passes a reply that quotes a live price', () => {
    expect(quotesOnlyKnownPrices('It is $47 to start or $197 for the whole vault.')).toBe(true);
  });

  it('passes a reply that quotes no price at all', () => {
    expect(quotesOnlyKnownPrices('Tell me what you are building first.')).toBe(true);
  });

  it('rejects a price we do not charge', () => {
    expect(quotesOnlyKnownPrices('I can do it for $37 today.')).toBe(false);
  });

  it('rejects the retired tier price a model is most likely to reach for', () => {
    // $97 was Essential for six weeks and is all over older copy.
    expect(quotesOnlyKnownPrices('Essential is $97.')).toBe(false);
  });

  it('is not fooled by a comma', () => {
    expect(quotesOnlyKnownPrices('That build is $15,000.')).toBe(false);
  });

  it('accepts a live price written with cents, and rejects a nearby wrong one', () => {
    expect(quotesOnlyKnownPrices('It is $47.00 flat.')).toBe(true);
    expect(quotesOnlyKnownPrices('It is $47.50 flat.')).toBe(false);
  });

  /*
   * A numeric allowlist cannot catch a price that is real but attached to the
   * wrong thing, and that is the exact mistake in reach here: $299 IS one of
   * our prices (the AI Employee Pack add-on), so "the full library is $299"
   * sails through the allowlist while being the retired-tier claim PR #483
   * stripped off six surfaces of the landing page.
   */
  it('rejects the add-on price attached to the library', () => {
    expect(misattributesVaultPrice('The full library is $299.')).toBe(true);
    expect(misattributesVaultPrice('The whole vault is $299 one time')).toBe(true);
  });

  it('leaves the add-on price alone when it is attached to the add-on', () => {
    expect(misattributesVaultPrice('The AI Employee Pack is $299 on top.')).toBe(false);
    expect(misattributesVaultPrice('The whole vault is $197 one time.')).toBe(false);
  });
});
