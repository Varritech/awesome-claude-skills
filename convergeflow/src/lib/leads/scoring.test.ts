import { describe, it, expect } from 'vitest';
import { scoreLeadEngagement, type EmailRecord, type LeadRecord } from './scoring';

const lead: LeadRecord = { id: 'lead_1' };

const sentEmail = (): EmailRecord => ({ id: 'em_1', status: 'sent' });

describe('scoreLeadEngagement', () => {
  it('returns 0 for a lead with no email activity', () => {
    expect(scoreLeadEngagement(lead, [])).toBe(0);
  });

  it('adds 10 points per opened email', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'sent', openedAt: '2026-01-01T10:00:00Z' },
      { id: 'em_2', status: 'sent', openedAt: '2026-01-02T10:00:00Z' },
    ];
    expect(scoreLeadEngagement(lead, emails)).toBe(20);
  });

  it('adds 25 points per replied email', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'sent', repliedAt: '2026-01-01T10:00:00Z' },
    ];
    expect(scoreLeadEngagement(lead, emails)).toBe(25);
  });

  it('adds 50 points when lead has a booked email', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'sent', bookedAt: '2026-01-01T10:00:00Z' },
    ];
    expect(scoreLeadEngagement(lead, emails)).toBe(50);
  });

  it('deducts 10 points per bounced email', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'bounced' },
    ];
    expect(scoreLeadEngagement(lead, emails)).toBe(0); // clamped to 0
  });

  it('deducts 20 points if lead is unsubscribed', () => {
    const unsubLead: LeadRecord = { id: 'lead_1', status: 'unsubscribed' };
    expect(scoreLeadEngagement(unsubLead, [sentEmail()])).toBe(0); // 0 - 20, clamped
  });

  it('combines multiple signals correctly', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'sent', openedAt: '2026-01-01T10:00:00Z' }, // +10
      { id: 'em_2', status: 'sent', openedAt: '2026-01-02T10:00:00Z', repliedAt: '2026-01-02T12:00:00Z' }, // +10 +25
      { id: 'em_3', status: 'bounced' }, // -10
    ];
    // 10 + 10 + 25 - 10 = 35
    expect(scoreLeadEngagement(lead, emails)).toBe(35);
  });

  it('caps score at 100', () => {
    const emails: EmailRecord[] = Array.from({ length: 5 }, (_, i) => ({
      id: `em_${i}`,
      status: 'sent',
      openedAt: '2026-01-01T10:00:00Z',
      repliedAt: '2026-01-01T11:00:00Z',
      bookedAt: '2026-01-01T12:00:00Z',
    }));
    // 5 * (10 + 25 + 50) = 425, capped at 100
    expect(scoreLeadEngagement(lead, emails)).toBe(100);
  });

  it('does not go below 0', () => {
    const unsubLead: LeadRecord = { id: 'lead_1', status: 'unsubscribed' };
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'bounced' },
      { id: 'em_2', status: 'bounced' },
      { id: 'em_3', status: 'bounced' },
    ];
    // -10 -10 -10 -20 = -50, clamped to 0
    expect(scoreLeadEngagement(unsubLead, emails)).toBe(0);
  });

  it('does not penalise non-bounced sent emails', () => {
    const emails: EmailRecord[] = [
      { id: 'em_1', status: 'sent' },
    ];
    expect(scoreLeadEngagement(lead, emails)).toBe(0);
  });

  it('opens and replies on same email stack correctly', () => {
    const emails: EmailRecord[] = [
      {
        id: 'em_1',
        status: 'sent',
        openedAt: '2026-01-01T10:00:00Z',
        repliedAt: '2026-01-01T12:00:00Z',
        bookedAt: '2026-01-01T14:00:00Z',
      },
    ];
    // 10 + 25 + 50 = 85
    expect(scoreLeadEngagement(lead, emails)).toBe(85);
  });
});
