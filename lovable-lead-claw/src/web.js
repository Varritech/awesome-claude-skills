// Domain check shared by the GitHub homepage test and the Firecrawl step: DNS resolves + HTTP answers.
import { lookup } from 'node:dns/promises';

export async function liveCheck(f, url) {
  try { if (isPrivateHost(new URL(url).hostname)) return false; } catch { return false; }
  const opts = { redirect: 'manual', signal: AbortSignal.timeout(12000) };
  try {
    let res = await f(url, { ...opts, method: 'HEAD' });
    if ([403, 405, 501].includes(res.status)) res = await f(url, { ...opts, method: 'GET', signal: AbortSignal.timeout(12000) });
    return res.status >= 200 && res.status < 400;
  } catch { return false; }
}

// Loopback, RFC1918, link-local (cloud metadata) and other non-public targets: never fetched from the Mini.
export function isPrivateHost(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || /^(fc|fd|fe80)/.test(h) || /^::ffff:/.test(h);
  return false;
}

export async function dnsResolves(host, look = lookup) {
  if (isPrivateHost(host)) return false;
  try { const r = await look(host); return !isPrivateHost(r?.address || ''); } catch { return false; }
}

// 'live' | 'dead' (answers 4xx, or the name/port/cert is gone) | 'flaky' (timeout, reset, 429, 5xx: says nothing about the site, retry later).
export async function probeSite(f, url) {
  const opts = () => ({ redirect: 'manual', signal: AbortSignal.timeout(12000) });
  try {
    let res = await f(url, { ...opts(), method: 'HEAD' });
    if ([403, 405, 501].includes(res.status)) res = await f(url, { ...opts(), method: 'GET' });
    if (res.status >= 200 && res.status < 400) return 'live';
    return res.status >= 500 || [408, 425, 429].includes(res.status) ? 'flaky' : 'dead';
  } catch (e) {
    const code = String(e?.cause?.code || e?.code || '');
    return /^(ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ERR_TLS|CERT_|DEPTH_ZERO|UNABLE_TO)/.test(code) ? 'dead' : 'flaky';
  }
}
