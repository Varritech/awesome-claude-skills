// Lead-quality filters (junk classes from the vibe-coded-app-lead-sourcing skill).
const FREE = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com',
  'proton.me', 'protonmail.com', 'aol.com', 'gmx.com', 'gmx.de', 'yandex.com', 'mail.com', 'qq.com', '163.com', 'hey.com']);
const PLACEHOLDER_DOMAINS = /(^|\.)(example\.(com|org|net)|voorbeeld\.nl|exemple\.fr|beispiel\.de|unternehmen\.de|firma\.de|empresa\.com|domain\.com|email\.com|yourdomain\.com|test\.com|resend\.dev|sendgrid\.net|mailgun\.org|amazonses\.com|lovable\.(dev|app)|gpt-engineer\.com|gptengineer\.app|noreply\.github\.com|github\.com|cursor\.com|cursor\.sh|anthropic\.com|openai\.com|vercel\.com|replit\.com|bolt\.new|v0\.dev|[a-z0-9-]+\.(local|localdomain|lan|internal|localhost|invalid))$/;
const SCHOOL = /(\.edu(\.[a-z]{2})?|\.ac\.[a-z]{2}|\.sch\.[a-z]{2}|\.k12\.[a-z.]+|\.school|\.edu\.[a-z]{2})$/;
const JUNK_REPO = /portfolio|portfomio|porfolio|portafolio|portifolio|resume|\bcv\b|homework|assignment|tutorial|clone|practice|course|test|hackathon|bootcamp|template|boilerplate/i;
const VENDOR_REPO = /\b(official|plugin|sdk|starter)\b|\b(component|library) (for|of)\b|\baudit (for|of)\b|\bapps? built with lovable\b/i;
const SCHOOL_WORD = /(^|[.-])(univ([-.\d]|$)|univers(ity|idad|idade|ite|itat)|college|polytech|ecole|utfpr|uivo)|(^|\.)ept\.sn$/;

export function emailDomain(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || '';
}

export function isFreeDomain(domain) {
  return FREE.has(String(domain).toLowerCase());
}

export function isJunkEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return true;
  const [local, domain] = e.split('@');
  if (/\[bot\]$|-bot$|^bot$/.test(local) || local.startsWith('noreply') || local.startsWith('no-reply')) return true;
  if (/^(test|your)$/i.test(local)) return true;
  if (/^(no-?reply|donotreply|onboarding|bot)$/i.test(local)) return true;
  if (PLACEHOLDER_DOMAINS.test(domain)) return true;
  if (SCHOOL.test(domain) || SCHOOL_WORD.test(domain)) return true;
  return false;
}

export function isJunkRepo({ name = '', description = '' } = {}) {
  return JUNK_REPO.test(`${name} ${description || ''}`) || VENDOR_REPO.test(description || '');
}

// Same address on 3+ distinct repos = library/template artifact.
export function dropRepeatEmails(rows, max = 3, known = new Map()) {
  const repos = new Map([...known].map(([e, set]) => [e.toLowerCase(), new Set(set)]));
  for (const r of rows) {
    const k = r.email.toLowerCase();
    (repos.get(k) || repos.set(k, new Set()).get(k)).add(r.repo);
  }
  return rows.filter((r) => repos.get(r.email.toLowerCase()).size < max);
}
