// Daily report email via Composio GMAIL_SEND_EMAIL (same call shape as the creator-report claw).
const usd = (n) => `$${Number(n).toFixed(2)}`;
const GITHUB_CORPUS = 78000;

export function buildReport(c, { today, firecrawl = null, leadsTarget = null }) {
  const left = Math.max(0, GITHUB_CORPUS - c.githubScannedTotal);
  const daysLeft = c.githubScanned > 0 ? Math.ceil(left / c.githubScanned) : null;
  const lines = [
    `Lovable lead claw, ${today}.`,
    `GitHub: ${c.newToday.github} new leads today.`,
    `LinkedIn: ${c.newToday.apify_linkedin} new leads today.`,
    `${c.total} leads in total, ${c.unsent} not yet contacted.`,
    `Apify spend: ${usd(c.spendToday)} today, ${usd(c.spendMonth)} this month.`,
    `GitHub progress: ${c.githubScannedTotal.toLocaleString('en-US')} of about ${GITHUB_CORPUS.toLocaleString('en-US')} repos scanned (${c.githubScanned} today${leadsTarget ? `, target ${leadsTarget} leads a day` : ''}).`,
    daysLeft === null ? 'Days left in the GitHub corpus: unknown, no repos scanned today.' : `The corpus has about ${daysLeft} days left at ${c.githubScanned.toLocaleString('en-US')} repos a day.`,
    firecrawl
      ? `Firecrawl: ${c.pagesToday || 0} of ${firecrawl.cap} pages used today, ${firecrawl.creditsLeft == null ? 'credits left unknown' : `${firecrawl.creditsLeft} credits left`}.`
      : 'Firecrawl: off (no key or zero page cap).',
    `${c.viaSiteToday || 0} of today's new leads came from emails found on the sites. ${c.scraped || 0} leads scraped, ${c.unscraped || 0} waiting.`,
    c.errors.length ? `Errors: ${c.errors.join('; ')}` : 'No errors.',
  ];
  return { subject: `Lovable leads ${today}: ${c.newToday.github + c.newToday.apify_linkedin} new`, text: lines.join('\n') };
}

export async function sendReport({ apiKey, userId, to, fetch: f = globalThis.fetch }, msg) {
  const res = await f('https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: userId, arguments: { recipient_email: to, subject: msg.subject, body: msg.text, is_html: false } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.successful === false) throw new Error(`report not sent: ${res.status} ${String(body.error ?? '')}`);
}
