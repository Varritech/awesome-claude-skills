// Newsletter audience = union of every email that came in through Claude Code
// Skills (Cristiano, 2026-07-03):
//   1. skill_downloads.email   — Skills Library purchasers (vds-marketing Supabase)
//   2. community_invites.email — founders community requests (same Supabase)
//   3. Gmail "New playbook lead" notifications — guide downloads (playbook-lead
//      route only emails the team, never persists to DB)
// mergeLeads/parsePlaybookLeadEmail are pure; loadLeads is the network adapter.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mergeLeads(lists, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map((e) => e.toLowerCase()));
  const seen = new Map();
  for (const list of lists) {
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const email = raw.trim();
      const key = email.toLowerCase();
      if (!EMAIL_RE.test(email) || excluded.has(key) || seen.has(key)) continue;
      seen.set(key, key);
    }
  }
  return [...seen.values()];
}

export function parsePlaybookLeadEmail(text) {
  const plain = String(text).replace(/<[^>]+>/g, ' '); // notifications arrive as HTML
  const m = plain.match(/Email:\s*([^\s@]+@[^\s@]+\.[^\s@<]+)/);
  return m ? m[1] : null;
}

async function fetchSupabaseEmails(table) {
  const url = process.env.LEADS_SUPABASE_URL;
  const key = process.env.LEADS_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('LEADS_SUPABASE_URL / LEADS_SUPABASE_SERVICE_KEY not set');
  const res = await fetch(`${url}/rest/v1/${table}?select=email`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`supabase ${table} -> ${res.status} ${await res.text()}`);
  return (await res.json()).map((r) => r.email);
}

// Guide downloads live only in Gmail — mine the internal notifications via Composio.
async function fetchPlaybookLeads() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error('COMPOSIO_API_KEY not set');
  const res = await fetch('https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: process.env.COMPOSIO_USER_ID || 'default',
      arguments: { query: 'subject:"New playbook lead"', max_results: 200 },
    }),
  });
  if (!res.ok) throw new Error(`Composio GMAIL_FETCH_EMAILS -> ${res.status} ${await res.text()}`);
  const data = await res.json();
  const messages = data?.data?.messages || data?.data?.response_data?.messages || [];
  return messages
    .map((m) => parsePlaybookLeadEmail(m.snippet || m.messageText || JSON.stringify(m)))
    .filter(Boolean);
}

// Log a newsletter click to ladk email_clicks (own-CRM attribution).
export async function logClick({ email, newsletter, dest_url, user_agent, ip }) {
  const url = process.env.LEADS_SUPABASE_URL;
  const key = process.env.LEADS_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('LEADS_SUPABASE_URL / LEADS_SUPABASE_SERVICE_KEY not set');
  const res = await fetch(`${url}/rest/v1/email_clicks`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newsletter, dest_url, user_agent, ip }),
  });
  if (!res.ok) throw new Error(`email_clicks -> ${res.status} ${await res.text()}`);
}

export async function loadLeads() {
  if (process.env.LEADS_JSON) return JSON.parse(process.env.LEADS_JSON); // manual override/testing
  // Audience = skills buyers + community + playbook guide leads + the full CRM
  // `leads` table (Cristiano 2026-07-08: all 178 leads get the newsletter). The
  // `leads` table already holds skills/community/stripe emails, so the union +
  // dedupe below collapses overlaps.
  const [buyers, community, guide, crm] = await Promise.all([
    fetchSupabaseEmails('skill_downloads'),
    fetchSupabaseEmails('community_invites'),
    fetchPlaybookLeads(),
    fetchSupabaseEmails('leads'),
  ]);
  const exclude = (process.env.EXCLUDE_EMAILS || 'christian@varritech.com,jake@varritech.com,varriale737@gmail.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return mergeLeads([buyers, community, guide, crm], { exclude });
}
