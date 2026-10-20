// Apify source: harvestapi/linkedin-profile-search, "Full + email search" mode.
// Cost model (actor page): $0.10 per search page (25 profiles) + $0.01 per full profile with email search.
import { emailDomain, isFreeDomain, isJunkEmail } from './filters.js';

const ACTOR = 'harvestapi~linkedin-profile-search';
const API = 'https://api.apify.com/v2';
const PAGE_SIZE = 25;
const PAGE_USD = 0.1;
const PROFILE_USD = 0.01;
const CALL_TIMEOUT_MS = 30000;
// errors that prove the request never reached Apify (nothing billed)
const CLEAN_FAIL = /^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN)$/;

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
    email, source: 'apify_linkedin', name, domain: host || (isFreeDomain(emailDomain(email)) ? null : emailDomain(email)),
    url: site || p.linkedinUrl || null, linkedin_url: p.linkedinUrl || null,
    title: pos.position || p.position || p.headline || null, company: pos.companyName || p.companyName || null,
    first_seen: today, data: { headline: p.headline || null, location: p.location?.linkedinText ?? p.location ?? null },
  };
}

export async function runApify({ db, token, fetch: f = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), budgetUsd = 2, today, dry = false, pollMs = 5000, maxWaitMs = 30 * 60 * 1000, itemsPerMin = 10 }) {
  const out = { scanned: 0, found: 0, kept: 0, inserted: 0, spendUsd: 0, ok: true, notes: '' };
  // size the run to what the wait window can deliver (observed ~14 profiles/min incl. email search), so it finishes instead of timing out
  const maxItems = Math.min(maxItemsFor(budgetUsd), Math.max(PAGE_SIZE, Math.floor((maxWaitMs / 60000) * itemsPerMin)));
  if (dry) return { ...out, notes: 'skipped (dry run)' };
  if (!token) return { ...out, notes: 'skipped (no APIFY_TOKEN)' };
  if (maxItems < 1) return { ...out, notes: 'skipped (budget 0)' };

  const call = (url, init = {}) => f(url, { ...init, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const cursor = (await db.getCursor('apify')) || { startPage: 1 };
  const takePages = Math.ceil(maxItems / PAGE_SIZE);

  const nextCursor = { startPage: cursor.startPage + takePages, last_run: today };
  let startRes;
  try {
    startRes = await call(`${API}/acts/${ACTOR}/runs?maxTotalChargeUsd=${budgetUsd}`, {
      method: 'POST', headers, body: JSON.stringify({ ...INPUT, maxItems, takePages, startPage: cursor.startPage }),
    });
  } catch (e) {
    // A request that was sent but whose answer was lost (timeout, reset) may have created a billed run.
    if (CLEAN_FAIL.test(e.cause?.code || e.code || '') || /^ECONNREFUSED$/.test(e.message)) throw e;
    await db.setCursor('apify', nextCursor);
    return { ...out, ok: false, spendUsd: budgetUsd, notes: `apify start response lost (${String(e.message).slice(0, 120)}); assumed $${budgetUsd} spent` };
  }
  if (!startRes.ok) throw new Error(`apify start failed: ${startRes.status}`);

  // From the moment the start request got a response the run exists and may bill up to the cap.
  // Any failure after that point logs the full cap as spent and moves the cursor, so a retry cannot buy it twice.
  const assumeCap = async (why) => {
    await db.setCursor('apify', nextCursor);
    return { ...out, ok: false, spendUsd: budgetUsd, notes: `apify run lost (${String(why).slice(0, 150)}); assumed $${budgetUsd} spent` };
  };
  let started;
  try { started = (await startRes.json()).data; } catch (e) { return assumeCap(e.message); }

  let run = started; const t0 = Date.now(); let bad = 0; let timedOut = false;
  try {
    while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
      if (Date.now() - t0 > maxWaitMs) {
        await call(`${API}/actor-runs/${started.id}/abort`, { method: 'POST', headers });
        run = { ...run, status: 'TIMED-OUT', usageTotalUsd: null };
        timedOut = true;
        break;
      }
      await sleep(pollMs);
      try {
        const r = await call(`${API}/actor-runs/${started.id}`, { headers });
        if (r.ok) { run = (await r.json()).data; bad = 0; } else bad++;
      } catch (e) { if (++bad >= 3) throw e; continue; }
      if (bad >= 3) throw new Error('status poll failing');
    }
    if (run.usageTotalUsd == null) { // abort path: read the final usage
      const r = await call(`${API}/actor-runs/${started.id}`, { headers });
      if (r.ok) run = { ...run, ...(await r.json()).data, ...(timedOut ? { status: 'TIMED-OUT' } : {}) };
    }
  } catch (e) {
    return assumeCap(e.message);
  }
  out.spendUsd = Number(run.usageTotalUsd ?? 0);
  const succeeded = run.status === 'SUCCEEDED';

  // The run is billed for whatever it produced, whether it finished or we aborted it: collect the dataset in every case but a plain FAILED.
  // Never throw from here, so the spend is still logged and the page is not bought twice.
  let items = null;
  if (succeeded || run.status !== 'FAILED') {
    try {
      const dsRes = await call(`${API}/datasets/${run.defaultDatasetId || started.defaultDatasetId}/items?clean=true&format=json`, { headers });
      if (!dsRes.ok) throw new Error(`apify dataset fetch failed: ${dsRes.status}`);
      items = await dsRes.json();
    } catch (e) {
      out.ok = false; out.notes = `after billing: ${String(e.message).slice(0, 200)}`;
    }
  }
  if (!succeeded) {
    out.ok = false;
    if (items) {
      // usageTotalUsd lags after an abort: never report less than the price list for what came back
      out.spendUsd = Math.max(out.spendUsd, estimateCost(items.length));
    } else if (run.status !== 'FAILED' && !out.spendUsd) out.spendUsd = budgetUsd; // no usage figure and no items to price: assume the worst
    out.notes = `apify run ${run.status}${items ? ` (kept ${items.length} items)` : ''}`;
    if (!items) {
      if (items === null && run.status !== 'FAILED' && out.spendUsd) await db.setCursor('apify', nextCursor);
      return out;
    }
  }
  if (items) {
    try {
      out.scanned = items.length;
      // usageTotalUsd may omit pay-per-event charges: never report less than the price list for what came back
      out.spendUsd = Math.max(out.spendUsd, estimateCost(items.length));
      const leads = items.map((p) => toLead(p, today)).filter(Boolean);
      out.found = out.kept = leads.length;
      out.inserted = (await db.insertLeads(leads)).length;
    } catch (e) {
      out.ok = false; out.notes = `after billing: ${String(e.message).slice(0, 200)}`;
    }
    await db.setCursor('apify', succeeded ? nextCursor : { ...nextCursor, startPage: cursor.startPage + Math.ceil(items.length / PAGE_SIZE) });
  } else if (succeeded) await db.setCursor('apify', nextCursor);
  return out;
}
