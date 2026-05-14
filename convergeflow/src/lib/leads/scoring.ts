/**
 * Lead engagement scoring.
 *
 * Pure function — no I/O. Given a lead and their email history,
 * returns a 0–100 engagement score.
 *
 * Scoring rules:
 *  +10 per email opened
 *  +25 per reply
 *  +50 if any email resulted in a booking
 *  -10 if any email bounced
 *  -20 if unsubscribed
 * Max 100, min 0.
 */

export interface EmailRecord {
  id: string;
  status: string; // 'queued' | 'sent' | 'bounced' | 'paused'
  openedAt?: string | null;
  clickedAt?: string | null;
  repliedAt?: string | null;
  bookedAt?: string | null;
}

export interface LeadRecord {
  id: string;
  status?: string; // includes 'unsubscribed'
}

export function scoreLeadEngagement(lead: LeadRecord, emails: EmailRecord[]): number {
  let score = 0;

  for (const email of emails) {
    if (email.openedAt) score += 10;
    if (email.repliedAt) score += 25;
    if (email.bookedAt) score += 50;
    if (email.status === 'bounced') score -= 10;
  }

  if (lead.status === 'unsubscribed') score -= 20;

  return Math.max(0, Math.min(100, score));
}
