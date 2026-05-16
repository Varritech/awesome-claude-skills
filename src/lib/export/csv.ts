/**
 * CSV generation utilities.
 *
 * Pure functions — no I/O. Generate CSV strings from data arrays.
 */

export interface LeadExportRow {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  status?: string;
  source?: string;
  tags?: string[];
  engagementScore?: number;
  createdAt?: string;
}

export interface CampaignExportRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  openRate: string;
  replyRate: string;
  createdAt?: string;
}

const LEAD_HEADERS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'company',
  'title',
  'industry',
  'location',
  'status',
  'source',
  'tags',
  'engagementScore',
  'createdAt',
];

const CAMPAIGN_HEADERS = [
  'id',
  'name',
  'status',
  'sent',
  'opened',
  'replied',
  'bounced',
  'openRate',
  'replyRate',
  'createdAt',
];

/** Escape a single CSV cell value (RFC 4180). */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(';') : String(value);
  // Wrap in quotes if the value contains comma, quote, newline, or carriage return
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV string from headers and rows. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function leadsToCSV(leads: LeadExportRow[]): string {
  const rows = leads.map((lead) => [
    lead.id,
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.company,
    lead.title,
    lead.industry,
    lead.location,
    lead.status,
    lead.source,
    lead.tags,
    lead.engagementScore,
    lead.createdAt,
  ]);
  return buildCsv(LEAD_HEADERS, rows);
}

export function campaignsToCSV(campaigns: CampaignExportRow[]): string {
  const rows = campaigns.map((c) => [
    c.id,
    c.name,
    c.status,
    c.sent,
    c.opened,
    c.replied,
    c.bounced,
    c.openRate,
    c.replyRate,
    c.createdAt,
  ]);
  return buildCsv(CAMPAIGN_HEADERS, rows);
}
