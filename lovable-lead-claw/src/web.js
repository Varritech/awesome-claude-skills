// Domain check shared by the GitHub homepage test and the Firecrawl step: DNS resolves + HTTP answers.
import { lookup } from 'node:dns/promises';

export async function liveCheck(f, url) {
  const opts = { redirect: 'manual', signal: AbortSignal.timeout(12000) };
  try {
    let res = await f(url, { ...opts, method: 'HEAD' });
    if ([403, 405, 501].includes(res.status)) res = await f(url, { ...opts, method: 'GET', signal: AbortSignal.timeout(12000) });
    return res.status >= 200 && res.status < 400;
  } catch { return false; }
}

export async function dnsResolves(host, look = lookup) {
  try { await look(host); return true; } catch { return false; }
}
