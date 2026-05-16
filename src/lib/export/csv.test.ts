import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildCsv, leadsToCSV, campaignsToCSV } from './csv';

describe('escapeCsvCell', () => {
  it('returns empty string for null', () => {
    expect(escapeCsvCell(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('returns plain string unchanged when no special chars', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
  });

  it('wraps in quotes when value contains comma', () => {
    expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps in quotes when value contains newline', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('joins array values with semicolon', () => {
    expect(escapeCsvCell(['tag1', 'tag2', 'tag3'])).toBe('tag1;tag2;tag3');
  });

  it('converts numbers to strings', () => {
    expect(escapeCsvCell(42)).toBe('42');
  });
});

describe('buildCsv', () => {
  it('builds a CSV with headers and one row', () => {
    const csv = buildCsv(['id', 'name'], [['1', 'Alice']]);
    expect(csv).toBe('id,name\r\n1,Alice');
  });

  it('builds a CSV with multiple rows', () => {
    const csv = buildCsv(['id', 'name'], [['1', 'Alice'], ['2', 'Bob']]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('id,name');
    expect(lines[1]).toBe('1,Alice');
    expect(lines[2]).toBe('2,Bob');
  });

  it('returns just header line for empty rows', () => {
    const csv = buildCsv(['id', 'name'], []);
    expect(csv).toBe('id,name');
  });
});

describe('leadsToCSV', () => {
  it('includes the correct headers', () => {
    const csv = leadsToCSV([]);
    const headerLine = csv.split('\r\n')[0];
    expect(headerLine).toBe(
      'id,firstName,lastName,email,company,title,industry,location,status,source,tags,engagementScore,createdAt',
    );
  });

  it('serialises a full lead record', () => {
    const csv = leadsToCSV([
      {
        id: 'lead_1',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        company: 'Acme',
        title: 'CEO',
        industry: 'Tech',
        location: 'SF',
        status: 'contacted',
        source: 'manual',
        tags: ['hot', 'vip'],
        engagementScore: 75,
        createdAt: '2026-01-01',
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe(
      'lead_1,Alice,Smith,alice@example.com,Acme,CEO,Tech,SF,contacted,manual,hot;vip,75,2026-01-01',
    );
  });

  it('handles missing optional fields gracefully', () => {
    const csv = leadsToCSV([{ id: 'lead_2' }]);
    const dataLine = csv.split('\r\n')[1];
    // id should be present, rest empty
    expect(dataLine).toMatch(/^lead_2,/);
  });
});

describe('campaignsToCSV', () => {
  it('includes the correct headers', () => {
    const csv = campaignsToCSV([]);
    const headerLine = csv.split('\r\n')[0];
    expect(headerLine).toBe('id,name,status,sent,opened,replied,bounced,openRate,replyRate,createdAt');
  });

  it('serialises a campaign record', () => {
    const csv = campaignsToCSV([
      {
        id: 'camp_1',
        name: 'Q1 Outreach',
        status: 'completed',
        sent: 500,
        opened: 180,
        replied: 25,
        bounced: 10,
        openRate: '36.0%',
        replyRate: '5.0%',
        createdAt: '2026-01-15',
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe(
      'camp_1,Q1 Outreach,completed,500,180,25,10,36.0%,5.0%,2026-01-15',
    );
  });

  it('wraps campaign name with commas in quotes', () => {
    const csv = campaignsToCSV([
      {
        id: 'camp_2',
        name: 'Q1, Q2 Outreach',
        status: 'running',
        sent: 100,
        opened: 30,
        replied: 5,
        bounced: 2,
        openRate: '30%',
        replyRate: '5%',
      },
    ]);
    expect(csv).toContain('"Q1, Q2 Outreach"');
  });
});
