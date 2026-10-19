// GitHub source: public repos whose package.json mentions "lovable-tagger".
// Code search caps at 1000 results/query, so the corpus is sharded by package.json byte size
// and (shard, page, skip) is persisted in lovable_lead_cursors so each daily run resumes.
import { emailDomain, isFreeDomain, isJunkEmail, isJunkRepo, dropRepeatEmails } from './filters.js';

const API = 'https://api.github.com';
const MAX_SIZE = 400000;
const SEARCH_GAP_MS = 6500; // code search allows ~10 req/min
const PER_PAGE = 100;
const BAD_HOSTS = /(^|\.)(github\.io|github\.com|gitlab\.io|linkedin\.com|twitter\.com|x\.com|npmjs\.com|youtube\.com|lovable\.dev)$/i;

export const initialCursor = () => ({ lo: 0, hi: 199, page: 1, skip: 0, step: 200 });

export function nextCursor(c, total) {
  let step = c.step || 200;
  if (total < 300) step = Math.min(step * 2, 5000);
  else if (total > 800) step = Math.max(1, Math.floor(step / 2));
  const lo = c.hi + 1;
  if (lo > MAX_SIZE) return { ...c, done: true };
  return { lo, hi: lo + step - 1, page: 1, skip: 0, step };
}

const query = (c) => `"lovable-tagger" filename:package.json size:${c.lo}..${c.hi}`;

function normalizeHomepage(h) {
  if (!h) return '';
  const s = /^https?:\/\//i.test(h) ? h : `https://${h}`;
  try {
    const u = new URL(s);
    if (BAD_HOSTS.test(u.hostname)) return '';
    if (/\.(vercel\.app|netlify\.app|pages\.dev|onrender\.com|web\.app)$/.test(u.hostname) && isJunkRepo({ name: u.hostname })) return '';
    return s;
  } catch { return ''; }
}

export async function runGithub({ db, token, fetch: f = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), budget = 800, today, dry = false, log = () => {} }) {
  const gh = async (path, params) => {
    const url = new URL(path.startsWith('http') ? path : API + path);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await f(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'lovable-lead-claw' } });
      const rateLimited = res.status === 429 || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.get('retry-after')));
      if (rateLimited) {
        const ra = Number(res.headers.get('retry-after'));
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        const wait = ra ? ra * 1000 : reset ? Math.max(1000, reset * 1000 - Date.now() + 1000) : 60000;
        log(`github ${res.status}, sleeping ${Math.round(wait / 1000)}s`);
        await sleep(Math.min(wait, 15 * 60 * 1000));
        continue;
      }
      return res;
    }
    throw new Error(`github rate limit not clearing for ${url.pathname}`);
  };

  const live = async (url) => {
    const opts = { redirect: 'manual', signal: AbortSignal.timeout(12000) };
    try {
      let res = await f(url, { ...opts, method: 'HEAD' });
      if ([403, 405, 501].includes(res.status)) res = await f(url, { ...opts, method: 'GET', signal: AbortSignal.timeout(12000) });
      return res.status >= 200 && res.status < 400;
    } catch { return false; }
  };

  async function processRepo(full) {
    const res = await gh(`/repos/${full}`);
    if (res.status >= 500) throw new Error(`repo ${res.status}`);
    if (!res.ok) return [];
    const meta = await res.json();
    if (meta.fork || meta.archived || isJunkRepo(meta)) return [];
    const cres = await gh(`/repos/${full}/commits`, { per_page: 30 });
    if (cres.status >= 500) throw new Error(`commits ${cres.status}`);
    if (!cres.ok) return [];
    const commits = await cres.json();
    const byEmail = new Map();
    for (const c of Array.isArray(commits) ? commits : []) {
      const em = c.commit?.author?.email?.trim().toLowerCase();
      if (!em || isJunkEmail(em)) continue;
      const e = byEmail.get(em) || { n: 0, name: c.commit.author.name || '' };
      e.n++; byEmail.set(em, e);
    }
    if (!byEmail.size) return [];
    const homepage = normalizeHomepage(meta.homepage);
    const homepageLive = homepage ? await live(homepage) : false;
    const rows = [];
    for (const [email, e] of [...byEmail].sort((a, b) => b[1].n - a[1].n).slice(0, 3)) {
      const dom = emailDomain(email);
      const companyDomain = !isFreeDomain(dom);
      if (!homepageLive && !companyDomain) continue;
      rows.push({
        email, source: 'github', name: e.name || null,
        domain: homepageLive ? new URL(homepage).hostname : dom,
        url: homepageLive ? homepage : `https://${dom}`,
        repo: full, first_seen: today,
        data: { description: meta.description || null, pushed_at: meta.pushed_at, owner_type: meta.owner?.type, homepage: homepage || null, homepage_live: homepageLive },
      });
    }
    return rows;
  }

  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => { log(`repo ${items[k]}: ${e.message}`); stats.failed++; return []; }); }
    }));
    return out;
  }

  let cursor = (await db.getCursor('github')) || initialCursor();
  const save = async () => { if (!dry) await db.setCursor('github', cursor); };
  const stats = { scanned: 0, found: 0, kept: 0, inserted: 0, failed: 0, notes: '' };
  const seen = []; // {email, repo} across the run, for the 3+ repos rule
  let lastSearch = 0;

  while (stats.scanned < budget && !cursor.done) {
    const gap = SEARCH_GAP_MS - (Date.now() - lastSearch);
    if (lastSearch && gap > 0) await sleep(gap);
    lastSearch = Date.now();
    const res = await gh('/search/code', { q: query(cursor), per_page: PER_PAGE, page: cursor.page });
    if (!res.ok) { stats.notes = `search ${res.status}`; throw new Error(`github code search failed: ${res.status}`); }
    const body = await res.json();
    const total = body.total_count || 0;
    if (cursor.page === 1 && cursor.skip === 0 && total > 1000 && cursor.hi > cursor.lo) {
      cursor = { ...cursor, hi: Math.floor((cursor.lo + cursor.hi) / 2), step: Math.max(1, Math.floor(cursor.step / 2)) };
      continue;
    }
    const maxPage = Math.ceil(Math.min(total, 1000) / PER_PAGE);
    if (cursor.page > maxPage || !body.items?.length) { cursor = nextCursor(cursor, total); await save(); continue; }

    const list = [...new Set(body.items.map((i) => i.repository.full_name))].slice(cursor.skip);
    const known = await db.existingRepos(list);
    const take = []; let consumed = 0;
    for (const r of list) {
      if (!known.has(r)) { if (stats.scanned + take.length >= budget) break; take.push(r); }
      consumed++;
    }
    const perRepo = await pool(take, 5, processRepo);
    stats.scanned += take.length;
    let rows = perRepo.flat();
    stats.found += rows.length;
    for (const r of rows) seen.push({ email: r.email, repo: r.repo });
    const emailKnown = rows.length ? await db.emailRepos([...new Set(rows.map((r) => r.email))]) : new Map();
    const dropped = new Set(dropRepeatEmails(seen, 3, emailKnown).map((s) => `${s.email}|${s.repo}`));
    const tooMany = new Set(rows.filter((r) => !dropped.has(`${r.email}|${r.repo}`) && emailKnown.has(r.email)).map((r) => r.email));
    rows = rows.filter((r) => dropped.has(`${r.email}|${r.repo}`));
    stats.kept += rows.length;
    if (!dry) {
      for (const e of tooMany) await db.rejectEmail(e);
      if (rows.length) {
        const stored = new Map((await db.insertLeads(rows)).map((r) => [r.email, r.repo]));
        stats.inserted += stored.size;
        // every other repo of a stored email goes into data.repos, so the 3+ rule counts it later
        for (const r of rows) if (stored.has(r.email) ? stored.get(r.email) !== r.repo : emailKnown.has(r.email)) await db.addRepo(r.email, r.repo);
      }
    }

    if (consumed < list.length) cursor = { ...cursor, skip: cursor.skip + consumed };
    else cursor = cursor.page + 1 > maxPage ? nextCursor(cursor, total) : { ...cursor, page: cursor.page + 1, skip: 0 };
    await save();
  }
  const notes = [];
  if (stats.failed) notes.push(`${stats.failed} repos failed (GitHub 5xx or error), skipped`);
  if (cursor.done) notes.push('corpus complete');
  stats.notes = notes.join('; ');
  stats.cursor = cursor;
  return stats;
}
