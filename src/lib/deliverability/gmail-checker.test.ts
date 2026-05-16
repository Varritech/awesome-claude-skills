import { describe, it, expect } from 'vitest';
import { checkGmailSpamRisk } from './gmail-checker';

describe('checkGmailSpamRisk', () => {
  it('returns zero score and no flags for a clean cold email', () => {
    const result = checkGmailSpamRisk({
      subject: 'Quick question about your team',
      body: 'Hi Sarah,\n\nI noticed your company is growing fast in the SaaS space. I wanted to reach out to see if there is a good fit.\n\nBest,\nJohn\n\nUnsubscribe here',
    });
    expect(result.riskScore).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it('flags spam trigger words in subject', () => {
    const result = checkGmailSpamRisk({
      subject: 'FREE WINNER urgent offer inside',
      body: 'Check out this deal. Unsubscribe below.',
    });
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.flags.some((f) => f.includes('Spam trigger words in subject'))).toBe(true);
  });

  it('flags spam trigger words in body', () => {
    const result = checkGmailSpamRisk({
      subject: 'Hello',
      body: 'You can earn money fast and guaranteed results. Click here now. Unsubscribe below.',
    });
    expect(result.flags.some((f) => f.includes('Spam trigger words in body'))).toBe(true);
  });

  it('flags excessive capital letters', () => {
    const result = checkGmailSpamRisk({
      subject: 'BIG SALE TODAY ONLY',
      body: 'AMAZING OFFER JUST FOR YOU TODAY ONLY LIMITED TIME. Unsubscribe below.',
    });
    expect(result.flags.some((f) => f.includes('Excessive capital'))).toBe(true);
  });

  it('flags too many links', () => {
    const result = checkGmailSpamRisk({
      subject: 'Check these out',
      body: 'Visit https://a.com and https://b.com and https://c.com and https://d.com for more info. Unsubscribe here.',
    });
    expect(result.flags.some((f) => f.includes('Too many links'))).toBe(true);
  });

  it('flags missing unsubscribe link', () => {
    const result = checkGmailSpamRisk({
      subject: 'Quick question',
      body: 'Hi there, just wanted to connect.',
    });
    expect(result.flags.some((f) => f.includes('unsubscribe'))).toBe(true);
  });

  it('accepts opt-out as unsubscribe equivalent', () => {
    const result = checkGmailSpamRisk({
      subject: 'Quick question',
      body: 'Hi there, just wanted to connect. To opt-out reply STOP.',
    });
    expect(result.flags.some((f) => f.includes('unsubscribe'))).toBe(false);
  });

  it('flags suspicious sending domain', () => {
    const result = checkGmailSpamRisk({
      subject: 'Hello',
      body: 'Message here. Unsubscribe below.',
      fromDomain: 'best-send-mail.xyz',
    });
    expect(result.flags.some((f) => f.includes('Suspicious sending domain'))).toBe(true);
  });

  it('does not flag legitimate domain', () => {
    const result = checkGmailSpamRisk({
      subject: 'Hello',
      body: 'Message here. Unsubscribe below.',
      fromDomain: 'varritech.com',
    });
    expect(result.flags.some((f) => f.includes('Suspicious sending domain'))).toBe(false);
  });

  it('flags all-caps subject', () => {
    const result = checkGmailSpamRisk({
      subject: 'IMPORTANT NOTICE',
      body: 'Please read this message carefully. Unsubscribe below.',
    });
    expect(result.flags.some((f) => f.includes('all uppercase'))).toBe(true);
  });

  it('flags excessive exclamation marks', () => {
    const result = checkGmailSpamRisk({
      subject: 'Amazing!!!',
      body: 'You won!!! Click here!!! Unsubscribe below.',
    });
    expect(result.flags.some((f) => f.includes('exclamation'))).toBe(true);
  });

  it('caps risk score at 100', () => {
    const result = checkGmailSpamRisk({
      subject: 'FREE WINNER URGENT CONGRATULATIONS GUARANTEED',
      body: 'EARN MONEY FAST!!! CLICK HERE!!! WORK FROM HOME CASH BONUS DISCOUNT 100% FREE RISK FREE SPECIAL OFFER EXCLUSIVE DEAL https://a.com https://b.com https://c.com https://d.com https://e.com',
      fromDomain: 'blast-send.xyz',
    });
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskScore).toBeGreaterThan(50);
  });

  it('known spam email produces score above 50', () => {
    const result = checkGmailSpamRisk({
      subject: 'You are a WINNER! Claim your FREE prize now',
      body: 'Congratulations! You have been selected for an exclusive deal. Click here to claim your free cash bonus. Limited time offer! Act now!\nhttps://spam.com\nhttps://spam2.com\nhttps://spam3.com\nhttps://spam4.com',
      fromDomain: 'discount-newsletter.xyz',
    });
    expect(result.riskScore).toBeGreaterThan(50);
  });

  it('professional outreach email scores 0', () => {
    const result = checkGmailSpamRisk({
      subject: 'Following up on our conversation',
      body: 'Hi Tom,\n\nJust wanted to follow up on the conversation we had last week about your marketing strategy.\n\nWould love to schedule a brief call at your convenience.\n\nBest regards,\nChristian\n\nTo unsubscribe from these emails, reply STOP.',
    });
    expect(result.riskScore).toBe(0);
    expect(result.flags).toHaveLength(0);
  });
});
