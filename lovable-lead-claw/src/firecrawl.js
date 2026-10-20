// Firecrawl v1 /scrape: one credit per page. Lovable apps are JS-rendered, so the page is fetched through Firecrawl, not plain HTTP.
const API = 'https://api.firecrawl.dev/v1';
const EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const ASSET_TLD = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|woff2?|ttf|mp4|pdf)$/i;

export function extractEmails(markdown, links = []) {
  const found = new Set();
  const take = (raw) => {
    const e = String(raw).toLowerCase().replace(/^mailto:/, '').replace(/[.,;:)\]]+$/, '');
    if (ASSET_TLD.test(e)) return;
    found.add(e);
  };
  for (const m of String(markdown || '').matchAll(EMAIL)) take(m[0]);
  for (const l of links || []) if (/^mailto:/i.test(l)) for (const m of l.replace(/^mailto:/i, '').split('?')[0].matchAll(EMAIL)) take(m[0]);
  return [...found];
}

export async function scrapePage({ apiKey, url, fetch: f = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = 60000 }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await f(`${API}/scrape`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown', 'links'], onlyMainContent: false, waitFor: 2500, timeout: 45000 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch { return { status: 'error' }; }
    if (res.status === 402) return { status: 'credits' };
    if (res.status === 429) { if (attempt === 0) { await sleep(15000); continue; } return { status: 'rate' }; }
    if (!res.ok) return { status: 'error' };
    const body = await res.json().catch(() => null);
    if (!body || body.success === false || !body.data) return { status: 'error' };
    const d = body.data;
    return { status: 'ok', title: d.metadata?.title || null, description: d.metadata?.description || null, emails: extractEmails(d.markdown, d.links) };
  }
  return { status: 'rate' };
}

export async function creditUsage({ apiKey, fetch: f = globalThis.fetch }) {
  try {
    const res = await f(`${API}/team/credit-usage`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000) });
    const n = (await res.json()).data?.remaining_credits;
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
