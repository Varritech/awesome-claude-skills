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
  /*
   * 2026-09-11 (Cristiano): the $47 tier is gone. Essential is $299 for every
   * skill in the vault; Premium is $999, the same vault plus five custom skills
   * the team builds. Live with vds-marketing-core PR #494.
   */
  it('carries the two live Skills tiers at their live prices', () => {
    const essential = OFFERS.find((o) => o.id === 'skills-essential');
    const premium = OFFERS.find((o) => o.id === 'skills-premium');
    expect(essential.price).toBe('$299');
    expect(premium.price).toBe('$999');
    expect(`${essential.summary} ${essential.includes.join(' ')}`).toMatch(/268/);
    expect(`${premium.summary} ${premium.includes.join(' ')}`).toMatch(/five custom skills/i);
  });

  it('does not describe Essential as a subset any more', () => {
    const essential = OFFERS.find((o) => o.id === 'skills-essential');
    expect(`${essential.summary} ${essential.includes.join(' ')}`).not.toMatch(/curated/i);
  });

  it('keeps the AI Employee Pack as a separate paid add-on, not part of the vault', () => {
    const addon = OFFERS.find((o) => o.id === 'ai-employee-pack');
    expect(addon.price).toBe('$299');
    expect(addon.kind).toBe('addon');
    // ⛔ PR #483: autonomous agents are NOT in either tier. Claiming they are
    // is the exact thing that got stripped off six surfaces of the LP.
    for (const id of ['skills-essential', 'skills-premium']) {
      const tier = OFFERS.find((o) => o.id === id);
      expect(`${tier.summary} ${tier.includes.join(' ')}`).not.toMatch(/autonomous agent/i);
    }
  });

  it('names all three guarantees, because they are the close', () => {
    const brief = offerBriefing();
    expect(brief).toMatch(/72-Hour Takeover/i);
    expect(brief).toMatch(/First-Hire/i);
    expect(brief).toMatch(/48-hour/i);
  });

  it('quotes no retired price anywhere', () => {
    const brief = offerBriefing();
    for (const dead of ['$47', '$97', '$197', '$297', '$129', '$149.99', '$15k', '$15,000']) {
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
    // The price-changed objection is still asked; the answer is that the old
    // entry tier is retired, not a Fast Movers window (both tiers are flat).
    expect(brief).toMatch(/entry tier is retired/i);
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
    expect(quotesOnlyKnownPrices('It is $299 for the whole vault or $999 with five custom skills.')).toBe(true);
  });

  it('rejects the retired $47 / $197 pair', () => {
    expect(quotesOnlyKnownPrices('Essential is $47.')).toBe(false);
    expect(quotesOnlyKnownPrices('Premium is $197.')).toBe(false);
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
    expect(quotesOnlyKnownPrices('It is $299.00 flat.')).toBe(true);
    expect(quotesOnlyKnownPrices('It is $299.50 flat.')).toBe(false);
  });

  /*
   * A numeric allowlist cannot catch a price that is real but attached to the
   * wrong tier. Both $299 and $999 are live, so "the vault is $999" or
   * "Premium is $299" sail through the allowlist while being wrong: the vault
   * is Essential at $299, and $999 is Premium, the vault plus five custom
   * skills. (Until 2026-09-11 this guard did the opposite and rejected "the
   * library is $299", which is now the correct price.)
   */
  it('rejects a tier paired with the other tier\'s price', () => {
    expect(misattributesVaultPrice('The full library is $999.')).toBe(true);
    expect(misattributesVaultPrice('The whole vault is $999 one time')).toBe(true);
    expect(misattributesVaultPrice('Essential is $999.')).toBe(true);
    expect(misattributesVaultPrice('Premium is $299.')).toBe(true);
  });

  it('passes each price attached to its own tier', () => {
    expect(misattributesVaultPrice('The whole vault is $299 one time.')).toBe(false);
    expect(misattributesVaultPrice('Premium is $999, with five custom skills built for you.')).toBe(false);
    expect(misattributesVaultPrice('The AI Employee Pack is $299 on top.')).toBe(false);
    expect(misattributesVaultPrice('Premium is $999 and Essential $299.')).toBe(false);
    expect(misattributesVaultPrice('It is $299 for the vault or $999 with five custom skills.')).toBe(false);
  });
});
