import { describe, it, expect } from 'vitest';
import { matchesIcp } from '../src/prospects.js';

describe('matchesIcp', () => {
  it('accepts an owner or founder of a running business', () => {
    expect(matchesIcp({ headline: 'Founder & CEO at Brightline Marketing' })).toBe(true);
    expect(matchesIcp({ headline: 'Owner, Smith Plumbing & Heating' })).toBe(true);
  });

  it('rejects people who cannot buy: employees, recruiters, students, job seekers', () => {
    expect(matchesIcp({ headline: 'Senior Account Executive at Salesforce' })).toBe(false);
    expect(matchesIcp({ headline: 'Technical Recruiter | Hiring Founders' })).toBe(false);
    expect(matchesIcp({ headline: 'Student at NYU, aspiring founder' })).toBe(false);
    expect(matchesIcp({ headline: 'Former CEO, open to work' })).toBe(false);
  });
});
