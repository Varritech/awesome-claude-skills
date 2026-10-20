// Domain check + Firecrawl scrape of each lead's site. Dead domains cost no credit. Own-domain emails found on a site become extra lead rows.
import { scrapePage } from './firecrawl.js';
import { liveCheck, dnsResolves } from './web.js';
import { emailDomain, isFreeDomain, isJunkEmail } from './filters.js';

const SKIP_HOST = /(^|\.)(linkedin\.com|github\.com|github\.io|gitlab\.io|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|npmjs\.com|lovable\.(app|dev)|lovableproject\.com|gptengineer\.app)$/i;
const ROLE_BOX = /^(privacy|legal|abuse|dpo|gdpr|postmaster|webmaster|press|careers|jobs|hr|unsubscribe|compliance)$/i;
const MAX_EXTRA_PER_SITE = 3;
const NOT_PERSISTED = new Set(['capped', 'credits', 'rate', 'dry']);

const cleanUrl = (s) => {
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return SKIP_HOST.test(u.hostname) ? null : `${u.origin}${u.pathname.replace(/\/$/, '')}`; } catch { return null; }
};
const bare = (host) => String(host).toLowerCase().replace(/^www\./, '');

// The site to check for a lead row: a live homepage, a company website, or the company email's domain. null = nothing to scrape.
export function siteTarget(row) {
  const d = row.data || {};
  const tries = [];
  if (d.homepage_live && d.homepage) tries.push(d.homepage);
  if (row.source === 'apify_linkedin' && row.domain && !isFreeDomain(row.domain)) tries.push(row.domain);
  const ed = emailDomain(row.email);
  if (ed && !isFreeDomain(ed)) tries.push(ed);
  for (const t of tries) { const u = cleanUrl(t); if (u) return u; }
  return null;
}

// Emails on the site's own domain: contact@, hello@, founder names. Never webmail, other companies, junk or legal/press boxes.
export function ownDomainEmails(emails, host) {
  const h = bare(host); const out = [];
  for (const e of emails || []) {
    const em = String(e).toLowerCase(); const d = emailDomain(em);
    if (!d || isJunkEmail(em) || isFreeDomain(d) || ROLE_BOX.test(em.split('@')[0])) continue;
    if (!(d === h || h.endsWith(`.${d}`) || d.endsWith(`.${h}`))) continue;
    if (!out.includes(em)) out.push(em);
  }
  return out.slice(0, MAX_EXTRA_PER_SITE);
}

export async function runSites({ db, apiKey, cap = 0, usedToday = 0, today, dry = false, candidates = [], fetch: f = globalThis.fetch, look, log = () => {}, concurrency = 4, batch = 200, maxExamine = 4000, scrape = scrapePage }) {
  const stats = { pages: 0, dead: 0, skipped: 0, errors: 0, extra: 0, inserted: 0, wouldScrape: 0, examined: 0, stopped: null, notes: '' };
  let left = Math.max(0, cap - usedToday);
  if (left <= 0) stats.stopped = 'cap';
  const hosts = new Map();

  const claim = () => { if (stats.stopped === 'credits' || stats.stopped === 'rate') return false; if (left <= 0) { stats.stopped ||= 'cap'; return false; } left--; return true; };

  function check(host, url) {
    if (hosts.has(host)) return hosts.get(host);
    const p = (async () => {
      if (!(await dnsResolves(host, look)) || !(await liveCheck(f, url))) return { status: 'dead' };
      const prior = await db.siteForDomain(host).catch(() => null);
      if (prior) return { ...prior, status: 'ok', cached: true };
      if (!claim()) return { status: 'capped' };
      if (dry) { stats.wouldScrape++; return { status: 'dry' }; }
      const r = await scrape({ apiKey, url, fetch: f });
      if (r.status === 'ok') { stats.pages++; return { status: 'ok', title: r.title, description: r.description, emails: r.emails }; }
      left++; // Firecrawl bills successful pages only
      if (r.status === 'credits' || r.status === 'rate') { stats.stopped = r.status; return { status: r.status }; }
      stats.errors++;
      return { status: 'error' };
    })();
    hosts.set(host, p);
    return p;
  }

  const extraSeen = new Set();
  async function addExtra(res, host, url, base) {
    const rows = ownDomainEmails(res.emails, host).filter((e) => e !== base.parent && !extraSeen.has(e)).map((email) => {
      extraSeen.add(email);
      return {
        email, source: base.source, name: null, domain: bare(host), url, repo: base.repo || null, company: base.company || null, first_seen: today,
        data: { via: 'site', ...(base.parent ? { parent: base.parent } : {}), homepage: url, homepage_live: true, ...(base.site ? { site: base.site } : { site: { status: 'inherited', scraped_at: today } }) },
      };
    });
    stats.extra += rows.length;
    if (rows.length && !dry) stats.inserted += (await db.insertLeads(rows)).length;
  }

  async function handleRow(row) {
    stats.examined++;
    const url = siteTarget(row);
    if (!url) { stats.skipped++; if (!dry) await db.setSite(row, { status: 'skipped', scraped_at: today }); return; }
    const host = new URL(url).hostname;
    const res = await check(host, url);
    if (res.status === 'dead') stats.dead++;
    if (NOT_PERSISTED.has(res.status)) return;
    const site = { title: res.title ?? null, description: res.description ?? null, emails: res.emails || [], scraped_at: res.scraped_at || today, status: res.status };
    if (!dry) await db.setSite(row, site);
    if (res.status === 'ok') await addExtra(res, host, url, { source: row.source === 'apify_linkedin' ? 'apify_linkedin' : 'github', repo: row.repo, company: row.company, parent: String(row.email).toLowerCase() });
  }

  async function handleCandidate(c) {
    const url = cleanUrl(c.url);
    if (!url) return;
    const host = new URL(url).hostname;
    const res = await check(host, url);
    if (res.status !== 'ok') return;
    await addExtra(res, host, url, { source: 'github', repo: c.repo, site: { title: res.title ?? null, description: res.description ?? null, emails: res.emails || [], scraped_at: today, status: 'ok' } });
  }

  async function pool(items, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) { const it = items[i++]; await fn(it).catch((e) => { stats.errors++; log(`site: ${e.message}`); }); }
    }));
  }

  try {
    await pool(candidates, handleCandidate);
    for (const phase of [{ firstSeen: today }, { before: today }]) {
      let afterId = 0;
      while (stats.examined < maxExamine) {
        const rows = await db.leadsNeedingSite({ ...phase, afterId, limit: batch });
        if (!rows.length) break;
        afterId = rows.at(-1).id;
        await pool(rows, handleRow);
        log(`site: examined ${stats.examined}, scraped ${stats.pages}, dead ${stats.dead}, skipped ${stats.skipped}, extra emails ${stats.extra}`);
      }
    }
  } catch (e) {
    stats.error = String(e.message).slice(0, 200);
    log(`site FAILED: ${e.message}`);
  }
  const notes = [];
  if (stats.stopped) notes.push(`stopped: ${stats.stopped}`);
  if (stats.errors) notes.push(`${stats.errors} scrape errors`);
  if (stats.error) notes.push(stats.error);
  stats.notes = notes.join('; ');
  return stats;
}
