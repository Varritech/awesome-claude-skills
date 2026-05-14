/**
 * Deliverability recommendations engine.
 *
 * Pure function — no I/O. Given a DeliverabilityMetrics object,
 * returns a list of actionable recommendations ordered by severity.
 */

export interface DeliverabilityMetrics {
  bounceRate: number; // 0–1 fraction (e.g. 0.06 = 6%)
  complaintRate: number; // 0–1 fraction (e.g. 0.002 = 0.2%)
  hasDkim: boolean;
  hasSpf: boolean;
  hasDmarc: boolean;
  warmupPercent: number; // 0–100 percent complete
  domain?: string;
  inboxCount?: number;
  avgOpenRate?: number; // 0–1 fraction
}

export type RecommendationSeverity = 'critical' | 'warning' | 'info';

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  action: string;
}

export function getRecommendations(metrics: DeliverabilityMetrics): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Critical ──────────────────────────────────────────────────────────────

  if (metrics.bounceRate > 0.05) {
    recs.push({
      id: 'high-bounce-rate',
      severity: 'critical',
      title: 'Reduce send volume',
      description: `Your bounce rate is ${(metrics.bounceRate * 100).toFixed(1)}%, which exceeds the 5% threshold. High bounce rates damage sender reputation and can lead to blacklisting.`,
      action: 'Pause campaigns, clean your list, remove unverified or invalid addresses, then gradually resume at lower volume.',
    });
  }

  if (!metrics.hasDkim) {
    const domainStr = metrics.domain ? ` for domain ${metrics.domain}` : '';
    recs.push({
      id: 'missing-dkim',
      severity: 'critical',
      title: `Configure DKIM${domainStr}`,
      description: 'DKIM (DomainKeys Identified Mail) is missing. Without DKIM, emails are more likely to be marked as spam by major providers like Gmail and Outlook.',
      action: 'Add a DKIM TXT record to your DNS. Generate a key pair via your email service provider and publish the public key.',
    });
  }

  if (!metrics.hasSpf) {
    recs.push({
      id: 'missing-spf',
      severity: 'critical',
      title: 'Add SPF record',
      description: 'SPF (Sender Policy Framework) is not configured. SPF tells receiving mail servers which IPs are authorized to send email for your domain.',
      action: 'Add a TXT record to your DNS: v=spf1 include:your-email-provider.com ~all',
    });
  }

  if (metrics.complaintRate > 0.001) {
    recs.push({
      id: 'high-complaint-rate',
      severity: 'critical',
      title: 'Address high spam complaint rate',
      description: `Your complaint rate is ${(metrics.complaintRate * 100).toFixed(2)}%, exceeding the 0.1% threshold. This will cause inbox providers to start filtering your emails.`,
      action: 'Review your email content and targeting. Ensure all recipients have opted in. Add a prominent unsubscribe link.',
    });
  }

  // ── Warning ────────────────────────────────────────────────────────────────

  if (!metrics.hasDmarc) {
    recs.push({
      id: 'missing-dmarc',
      severity: 'warning',
      title: 'Configure DMARC policy',
      description: 'DMARC is not set up. DMARC protects your domain from spoofing and provides reporting on authentication failures.',
      action: 'Add a DMARC TXT record: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com — start with p=none to collect reports before enforcing.',
    });
  }

  if (metrics.warmupPercent < 50) {
    recs.push({
      id: 'low-warmup',
      severity: 'warning',
      title: 'Continue inbox warmup',
      description: `Inbox warmup is ${metrics.warmupPercent}% complete. Sending at full volume before warmup completes risks deliverability issues.`,
      action: 'Allow the warmup process to continue. Avoid sending large campaigns until warmup reaches 100%.',
    });
  }

  if (metrics.bounceRate > 0.02 && metrics.bounceRate <= 0.05) {
    recs.push({
      id: 'elevated-bounce-rate',
      severity: 'warning',
      title: 'Monitor bounce rate',
      description: `Your bounce rate is ${(metrics.bounceRate * 100).toFixed(1)}%, approaching the 5% danger threshold. Take action before it escalates.`,
      action: 'Validate email addresses before sending. Use an email verification service to clean your list.',
    });
  }

  if (metrics.avgOpenRate !== undefined && metrics.avgOpenRate < 0.1) {
    recs.push({
      id: 'low-open-rate',
      severity: 'warning',
      title: 'Improve open rates',
      description: `Your average open rate is ${(metrics.avgOpenRate * 100).toFixed(1)}%, below the healthy threshold of 10%. Low open rates signal to inbox providers that recipients are not engaging.`,
      action: 'Test different subject lines, improve list targeting, and review send timing.',
    });
  }

  // ── Info ───────────────────────────────────────────────────────────────────

  if (metrics.warmupPercent >= 50 && metrics.warmupPercent < 100) {
    recs.push({
      id: 'warmup-in-progress',
      severity: 'info',
      title: 'Inbox warmup in progress',
      description: `Warmup is ${metrics.warmupPercent}% complete. Your sending capacity will increase automatically.`,
      action: 'No action needed. The warmup scheduler will continue automatically.',
    });
  }

  if (!metrics.inboxCount || metrics.inboxCount < 2) {
    recs.push({
      id: 'single-inbox',
      severity: 'info',
      title: 'Consider adding more sending inboxes',
      description: 'Using a single inbox limits your daily send capacity and creates a single point of failure.',
      action: 'Add additional warmed-up inboxes to distribute sending volume and improve reliability.',
    });
  }

  // Sort: critical → warning → info
  const order: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}
