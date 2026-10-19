// Apify source: harvestapi/linkedin-profile-search, "Full + email search" mode.
// Cost model (actor page): $0.10 per search page (25 profiles) + $0.01 per full profile with email search.
import { emailDomain, isJunkEmail } from './filters.js';

const ACTOR = 'harvestapi~linkedin-profile-search';
const API = 'https://api.apify.com/v2';
const PAGE_SIZE = 25;
const PAGE_USD = 0.1;
const PROFILE_USD = 0.01;

export const estimateCost = (items) => Math.round((Math.ceil(items / PAGE_SIZE) * PAGE_USD + items * PROFILE_USD) * 1e6) / 1e6;

export function maxItemsFor(budgetUsd) {
  let n = 0;
  while (estimateCost(n + 1) <= budgetUsd + 1e-9) n++;
  return n;
}

const INPUT = {
  profileScraperMode: 'Full + email search',
  searchQuery: 'app OR SaaS OR Lovable OR "no-code" OR startup',
  currentJobTitles: ['Founder', 'Co-Founder', 'CEO', 'Owner'],
  companyHeadcount: ['B'], // 1-10
};

function toLead(p, today) {
  const raw = p.email || p.emails?.[0]?.email || p.emails?.[0] || p.emailAddress || '';
  const email = String(raw).trim().toLowerCase();
  if (!email || isJunkEmail(email)) return null;
  const pos = Array.isArray(p.currentPosition) ? p.currentPosition[0] || {} : {};
  const site = pos.companyWebsite || p.companyWebsite || '';
  let host = '';
  try { host = site ? new URL(/^https?:/.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName || p.name || null;
  return {
    email, source: 'apify_linkedin', name, domain: host || emailDomain(email),
    url: site || p.linkedinUrl || null, linkedin_url: p.linkedinUrl || null,
    title: pos.position || p.position || p.headline || null, company: pos.companyName || p.companyName || null,
    first_seen: today, data: { headline: p.headline || null, location: p.location?.linkedinText ?? p.location ?? null },
  };
}

export async function runApify({ db, token, fetch: f = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), budgetUsd = 2, today, dry = false, pollMs = 5000, maxWaitMs = 10 * 60 * 1000 }) {
  const out = { scanned: 0, found: 0, kept: 0, inserted: 0, spendUsd: 0, ok: true, notes: '' };
  const maxItems = maxItemsFor(budgetUsd);
  if (dry) return { ...out, notes: 'skipped (dry run)' };
  if (!token) return { ...out, notes: 'skipped (no APIFY_TOKEN)' };
  if (maxItems < 1) return { ...out, notes: 'skipped (budget 0)' };

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const cursor = (await db.getCursor('apify')) || { startPage: 1 };
  const takePages = Math.ceil(maxItems / PAGE_SIZE);

  const startRes = await f(`${API}/acts/${ACTOR}/runs?maxTotalChargeUsd=${budgetUsd}`, {
    method: 'POST', headers, body: JSON.stringify({ ...INPUT, maxItems, takePages, startPage: cursor.startPage }),
  });
  if (!startRes.ok) throw new Error(`apify start failed: ${startRes.status}`);
  const { data: started } = await startRes.json();

  let run = started; const t0 = Date.now();
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
    if (Date.now() - t0 > maxWaitMs) {
      await f(`${API}/actor-runs/${started.id}/abort`, { method: 'POST', headers });
      run = { ...run, status: 'TIMED-OUT' };
      break;
    }
    await sleep(pollMs);
    const r = await f(`${API}/actor-runs/${started.id}`, { headers });
    if (r.ok) run = (await r.json()).data;
  }
  if (run.usageTotalUsd === undefined) { // abort path: read the final usage
    const r = await f(`${API}/actor-runs/${started.id}`, { headers });
    if (r.ok) run = { ...run, ...(await r.json()).data };
  }
  out.spendUsd = Number(run.usageTotalUsd ?? 0);
  if (run.status !== 'SUCCEEDED') return { ...out, ok: false, notes: `apify run ${run.status}` };

  // From here the run is billed: never throw, so the spend is still logged and the page is not bought twice.
  const nextCursor = { startPage: cursor.startPage + takePages, last_run: today };
  try {
    const dsRes = await f(`${API}/datasets/${run.defaultDatasetId || started.defaultDatasetId}/items?clean=true&format=json`, { headers });
    if (!dsRes.ok) throw new Error(`apify dataset fetch failed: ${dsRes.status}`);
    const items = await dsRes.json();
    out.scanned = items.length;
    // usageTotalUsd may omit pay-per-event charges: never report less than the price list for what came back
    out.spendUsd = Math.max(out.spendUsd, estimateCost(items.length));
    const leads = items.map((p) => toLead(p, today)).filter(Boolean);
    out.found = out.kept = leads.length;
    out.inserted = (await db.insertLeads(leads)).length;
  } catch (e) {
    out.ok = false; out.notes = `after billing: ${String(e.message).slice(0, 200)}`;
  }
  await db.setCursor('apify', nextCursor);
  return out;
}
