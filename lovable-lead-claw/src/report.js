// Daily report email via Composio GMAIL_SEND_EMAIL (same call shape as the creator-report claw).
const usd = (n) => `$${Number(n).toFixed(2)}`;
const GITHUB_CORPUS = 78000;

export function buildReport(c, { today }) {
  const lines = [
    `Lovable lead claw, ${today}.`,
    `GitHub: ${c.newToday.github} new leads today.`,
    `LinkedIn: ${c.newToday.apify_linkedin} new leads today.`,
    `${c.total} leads in total, ${c.unsent} not yet contacted.`,
    `Apify spend: ${usd(c.spendToday)} today, ${usd(c.spendMonth)} this month.`,
    `GitHub progress: ${c.githubScannedTotal.toLocaleString('en-US')} of about ${GITHUB_CORPUS.toLocaleString('en-US')} repos scanned (${c.githubScanned} today).`,
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
