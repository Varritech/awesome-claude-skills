/**
 * /api/deliverability - domain health & inbox placement snapshot.
 *
 * Aggregates real data from the user's domains, inboxes, emails, and
 * trackingDomains collections. Returns empty arrays / zeros when no data
 * exists — never fabricated DNS records, blacklist checks, or provider
 * placement percentages.
 *
 * Blacklist and provider inbox-placement data are not yet sourced (no
 * external integration in place); these intentionally return empty arrays
 * so the UI's empty states render instead of fake numbers.
 *
 * Returns: { healthScore, inboxes[], bounceTrend[], dnsRecords[],
 *   blacklistChecks[], inboxProviders[], inboxHealth, inboxHealthLabel,
 *   trackingDomainEnabled, trackingDomain }
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logRequest, requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DnsStatus = 'valid' | 'warning' | 'invalid';
type DomainDnsStatus = 'pending' | 'red' | 'yellow' | 'green';

interface DnsInstruction {
  host: string;
  type: string;
  value: string;
}

interface DomainRecord {
  id: string;
  userId: string;
  domain: string;
  spfStatus: DomainDnsStatus;
  dkimStatus: DomainDnsStatus;
  dmarcStatus: DomainDnsStatus;
  mxStatus: DomainDnsStatus;
  overallStatus: DomainDnsStatus;
  dnsInstructions?: {
    spf?: DnsInstruction;
    dkim?: DnsInstruction;
    dmarc?: DnsInstruction;
    mx?: DnsInstruction;
  };
}

interface InboxRecord {
  id: string;
  userId: string;
  email: string;
  domain?: string;
}

interface EmailRecord {
  id: string;
  userId: string;
  inboxId?: string;
  status: 'draft' | 'queued' | 'sent' | 'opened' | 'replied' | 'bounced';
  sentAt?: string | null;
  bouncedAt?: string | null;
  complaintAt?: string | null;
}

interface TrackingDomainRecord {
  id: string;
  domain: string;
  verified: boolean;
}

function mapDnsStatus(s: DomainDnsStatus): DnsStatus {
  switch (s) {
    case 'green':
      return 'valid';
    case 'yellow':
      return 'warning';
    case 'red':
      return 'invalid';
    case 'pending':
    default:
      return 'warning';
  }
}

function inboxHealthLabelOf(score: number, hasData: boolean): string {
  if (!hasData) return 'No data';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'At risk';
  return 'Poor';
}

function toDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('deliverability.GET', userId);

  const [domainsSnap, inboxesSnap, emailsSnap, trackingSnap] = await Promise.all([
    adminDb.collection('domains').where('userId', '==', userId).get().catch(() => null),
    adminDb.collection('inboxes').where('userId', '==', userId).get().catch(() => null),
    adminDb
      .collection('emails')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get()
      .catch(() => null),
    adminDb.collection('trackingDomains').where('userId', '==', userId).get().catch(() => null),
  ]);

  const domains: DomainRecord[] = domainsSnap
    ? domainsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }))
    : [];
  const inboxes: InboxRecord[] = inboxesSnap
    ? inboxesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxRecord, 'id'>) }))
    : [];
  const emails: EmailRecord[] = emailsSnap
    ? emailsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmailRecord, 'id'>) }))
    : [];
  const trackingDomains: TrackingDomainRecord[] = trackingSnap
    ? trackingSnap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<TrackingDomainRecord, 'id'>) }),
      )
    : [];

  // ── DNS records: one row per domain × record type ──────────────────────
  const dnsRecords: Array<{ type: string; value: string; status: DnsStatus }> = [];
  for (const dom of domains) {
    const ins = dom.dnsInstructions;
    if (ins?.spf) {
      dnsRecords.push({
        type: `SPF (${dom.domain})`,
        value: ins.spf.value,
        status: mapDnsStatus(dom.spfStatus),
      });
    }
    if (ins?.dkim) {
      dnsRecords.push({
        type: `DKIM (${dom.domain})`,
        value: ins.dkim.value,
        status: mapDnsStatus(dom.dkimStatus),
      });
    }
    if (ins?.dmarc) {
      dnsRecords.push({
        type: `DMARC (${dom.domain})`,
        value: ins.dmarc.value,
        status: mapDnsStatus(dom.dmarcStatus),
      });
    }
    if (ins?.mx) {
      dnsRecords.push({
        type: `MX (${dom.domain})`,
        value: ins.mx.value,
        status: mapDnsStatus(dom.mxStatus),
      });
    }
  }

  // ── Per-inbox SPF/DKIM/DMARC bool, bounce + complaint rate ─────────────
  const domainByName = new Map<string, DomainRecord>(domains.map((d) => [d.domain, d]));
  const emailsByInbox = new Map<string, EmailRecord[]>();
  for (const e of emails) {
    if (!e.inboxId) continue;
    const list = emailsByInbox.get(e.inboxId) ?? [];
    list.push(e);
    emailsByInbox.set(e.inboxId, list);
  }

  const perInbox = inboxes.map((inbox) => {
    const inboxDomain = inbox.domain ?? inbox.email.split('@')[1] ?? '';
    const dom = domainByName.get(inboxDomain);
    const inboxEmails = emailsByInbox.get(inbox.id) ?? [];
    const sent = inboxEmails.filter((e) => Boolean(e.sentAt)).length;
    const bounced = inboxEmails.filter((e) => e.status === 'bounced').length;
    const complaints = inboxEmails.filter((e) => Boolean(e.complaintAt)).length;
    return {
      id: inbox.id,
      email: inbox.email,
      spf: dom?.spfStatus === 'green',
      dkim: dom?.dkimStatus === 'green',
      dmarc: dom?.dmarcStatus === 'green',
      bounceRate: sent === 0 ? 0 : bounced / sent,
      complaintRate: sent === 0 ? 0 : complaints / sent,
    };
  });

  // ── Inbox health: derived from bounce rate ─────────────────────────────
  const totalSent = emails.filter((e) => Boolean(e.sentAt)).length;
  const totalBounced = emails.filter((e) => e.status === 'bounced').length;
  const hasSendData = totalSent > 0;
  const inboxHealth = hasSendData
    ? Math.max(0, 100 - Math.round((totalBounced / totalSent) * 100))
    : 0;

  // ── Bounce trend (last 7 days, bounce % per day) ───────────────────────
  const trendDays = 7;
  const trend: Array<{ date: string; sent: number; bounced: number }> = [];
  const trendIndex = new Map<string, number>();
  const today = new Date();
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendIndex.set(key, trend.length);
    trend.push({ date: key, sent: 0, bounced: 0 });
  }
  for (const e of emails) {
    const sentKey = toDateKey(e.sentAt);
    if (sentKey && trendIndex.has(sentKey)) {
      trend[trendIndex.get(sentKey)!].sent += 1;
    }
    if (e.status === 'bounced') {
      const bouncedKey = toDateKey(e.bouncedAt) ?? sentKey;
      if (bouncedKey && trendIndex.has(bouncedKey)) {
        trend[trendIndex.get(bouncedKey)!].bounced += 1;
      }
    }
  }
  const bounceTrend = trend.map((pt) => ({
    date: pt.date,
    rate: pt.sent === 0 ? 0 : Number(((pt.bounced / pt.sent) * 100).toFixed(2)),
  }));

  // ── Tracking domain ────────────────────────────────────────────────────
  const verifiedTracking = trackingDomains.find((t) => t.verified) ?? trackingDomains[0];
  const trackingDomainEnabled = Boolean(verifiedTracking?.verified);
  const trackingDomain = verifiedTracking?.domain ?? null;

  return NextResponse.json({
    data: {
      healthScore: inboxHealth,
      inboxes: perInbox,
      bounceTrend,
      dnsRecords,
      // No external blacklist or inbox-placement integration yet — return
      // empty so the UI renders its "No data" state instead of fake values.
      blacklistChecks: [],
      inboxProviders: [],
      inboxHealth,
      inboxHealthLabel: inboxHealthLabelOf(inboxHealth, hasSendData),
      trackingDomainEnabled,
      trackingDomain,
    },
  });
}
