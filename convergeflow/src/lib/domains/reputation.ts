/**
 * Domain reputation checks via DNS + WHOIS.
 * Scores a sending domain 0-100 based on email authentication records.
 */

import { promises as dns } from 'dns';

export interface DomainReputation {
  age?: number; // days since domain registration (null if unavailable)
  mxValid: boolean;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  reputationScore: number; // 0–100
}

async function checkMx(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

async function checkSpf(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(domain);
    return records.some((r) => r.join('').includes('v=spf1'));
  } catch {
    return false;
  }
}

async function checkDkim(domain: string, selector = 'cf'): Promise<boolean> {
  try {
    const host = `${selector}._domainkey.${domain}`;
    const records = await dns.resolveTxt(host);
    return records.some((r) => r.join('').includes('v=DKIM1'));
  } catch {
    return false;
  }
}

async function checkDmarc(domain: string): Promise<boolean> {
  try {
    const host = `_dmarc.${domain}`;
    const records = await dns.resolveTxt(host);
    return records.some((r) => r.join('').includes('v=DMARC1'));
  } catch {
    return false;
  }
}

async function getDomainAge(domain: string): Promise<number | undefined> {
  const apiKey = process.env.WHOAPI_KEY;
  if (!apiKey) return undefined;

  try {
    const url = `https://api.whoapi.com/?domain=${encodeURIComponent(domain)}&r=whois&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const data = await res.json() as { date_created?: string };
    if (!data.date_created) return undefined;
    const created = new Date(data.date_created);
    if (isNaN(created.getTime())) return undefined;
    const ageMs = Date.now() - created.getTime();
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  } catch {
    return undefined;
  }
}

function calculateScore(checks: {
  mxValid: boolean;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  age?: number;
}): number {
  let score = 0;
  // Each DNS check: 20 points (4 checks = 80 points max)
  if (checks.mxValid) score += 20;
  if (checks.spfValid) score += 20;
  if (checks.dkimValid) score += 20;
  if (checks.dmarcValid) score += 20;
  // Age bonus: up to 20 points (full 20 at 365+ days)
  if (checks.age !== undefined) {
    score += Math.min(20, Math.floor((checks.age / 365) * 20));
  }
  return Math.min(100, score);
}

export async function getDomainReputation(domain: string): Promise<DomainReputation> {
  const [mxValid, spfValid, dkimValid, dmarcValid, age] = await Promise.all([
    checkMx(domain),
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
    getDomainAge(domain),
  ]);

  const reputationScore = calculateScore({ mxValid, spfValid, dkimValid, dmarcValid, age });

  return { age, mxValid, spfValid, dkimValid, dmarcValid, reputationScore };
}
