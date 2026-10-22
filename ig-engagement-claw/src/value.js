// Value touchpoints: every follow-up carries ONE real thing of value.
//
// Cristiano, 2026-10-22: "when it follows up with people, it needs to provide
// them with value. Something short ... news in AI ... different models, tools,
// products, like the Varritech AI router ... guides on how to build things.
// Always with value, not just wishing you the best with whatever they created."
//
// The library is three kinds of item:
//   news    researched daily, each with a source url + date + a "why a builder
//           cares" line; anything unsourced is dropped, anything older than
//           NEWS_MAX_AGE_DAYS expires. Stored in state/value-library.json.
//   guide   the nine Varritech Playbook guides (urls verified 200).
//   router  the Varritech AI Router, offered free BY REPLY (see ROUTER_OFFER).
//
// Node owns the policy (which item, never twice, what a draft may contain); the
// model only words one short message around the item it is handed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { stripEmDashes, hasPlaceholder, ALLOWED_LINK_HOSTS } from './opener.js';

export const NEWS_MAX_AGE_DAYS = 14;
const DAY = 86400_000;
const URL_RE = /https?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;

/**
 * The router has NO public free signup: the live page (varritech.com/router)
 * is "add a card, pay provider cost + 5%". So the offer is by reply and never
 * carries a link. Cristiano can grant access by hand. If a free-trial signup
 * URL ever exists, add it here and flip the test.
 */
export const ROUTER_OFFER = {
  id: 'router-free-access',
  type: 'router',
  title: 'Varritech AI Router',
  why: 'one OpenAI-compatible endpoint that sends each request to the cheapest model that can do the job; reply and I will set you up with free access',
  tags: ['cost', 'api', 'agents', 'agency', 'llm', 'automation', 'marketing', 'bill', 'openai'],
  anchors: ['router'],
};

const GUIDE_BASE = process.env.GUIDE_BASE_URL || 'https://varritech-product-playbook.vercel.app';
const guide = (n, title, topic, tags, anchors) => ({
  id: `guide-${n}`, type: 'guide', title, topic, url: `${GUIDE_BASE}/guide-${n}`,
  why: `a free step-by-step guide on ${topic}`, tags, anchors,
});

// All nine return 200 and carry these titles (checked 2026-10-22).
export const GUIDES = [
  guide(1, 'Product Strategy & Discovery', 'product strategy and discovery', ['strategy', 'idea', 'validate', 'product', 'startup', 'discovery', 'customers'], ['strategy', 'discovery']),
  guide(2, 'UI/UX Design System', 'building a UI/UX design system', ['design', 'ui', 'ux', 'brand', 'figma', 'frontend'], ['design system', 'ui/ux', 'design']),
  guide(3, 'Full-Stack Engineering', 'full-stack engineering for a product', ['engineering', 'code', 'app', 'build', 'developer', 'saas', 'stack', 'backend'], ['engineering', 'full-stack']),
  guide(4, 'Security & Compliance', 'security and compliance', ['security', 'compliance', 'privacy', 'bank', 'regulated'], ['security', 'compliance']),
  guide(5, 'QA & Testing', 'QA and testing', ['testing', 'qa', 'bugs', 'quality'], ['testing', 'qa']),
  guide(6, 'Marketing & Growth', 'marketing and growth', ['marketing', 'growth', 'ads', 'seo', 'audience', 'content', 'brand', 'agency'], ['marketing', 'growth']),
  guide(7, 'AI-Powered Scaling', 'scaling a business with AI', ['ai', 'agents', 'automation', 'scale', 'workflow', 'claude'], ['ai scaling', 'scaling']),
  guide(8, 'AI Ad Scaling', 'scaling ad spend with AI', ['ads', 'meta', 'facebook', 'campaign', 'creative', 'ecommerce'], ['ad scaling', 'ads']),
  guide(9, 'Analytics & Conversion Systems', 'analytics and conversion systems', ['analytics', 'conversion', 'funnel', 'data', 'tracking', 'dashboard'], ['analytics', 'conversion']),
];

/** The empty check-ins Cristiano banned. Any hit rejects the draft. */
export const BANNED_PHRASES = [
  /hope (it'?s|it is|things are|everything is|all is) (going )?well/i,
  /hope you('re| are) (doing )?(well|good|great)/i,
  /wishing you (the )?best/i,
  /best of luck/i,
  /just (following|checking|circling|touching)/i,
  /following up/i,
  /checking in/i,
  /circling back/i,
  /touch(ing)? base/i,
  /bump(ing)? this/i,
  /did you see my (last |previous )?(message|dm)/i,
  /door'?s? (is )?(always )?open/i,
  /no worries/i,
  /rooting for you/i,
  /keep (it )?up/i,
];

export function isValidNewsItem(n) {
  if (!n || typeof n !== 'object') return false;
  if (!String(n.id ?? '').trim() || !String(n.title ?? '').trim() || !String(n.why ?? '').trim()) return false;
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/.test(String(n.url ?? ''))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.date ?? '')) || Number.isNaN(Date.parse(n.date))) return false;
  return Array.isArray(n.anchors) && n.anchors.length > 0;
}

const ageDays = (iso, now) => Math.floor((now.getTime() - Date.parse(`${iso}T00:00:00Z`)) / DAY);

/** Drop expired items and impossible dates (a future date would never expire). */
export function pruneNews(items, now = new Date()) {
  return (items ?? []).filter((n) => {
    const age = ageDays(n.date, now);
    return age >= -1 && age <= NEWS_MAX_AGE_DAYS;
  });
}

export function buildLibrary({ news = [], now = new Date() } = {}) {
  const live = pruneNews(news.filter(isValidNewsItem), now).map((n) => ({ ...n, type: 'news' }));
  return { now, items: [...live, ...GUIDES, ROUTER_OFFER] };
}

const words = (s) => String(s ?? '').toLowerCase().match(/[a-z0-9/+.]+/g) ?? [];

/**
 * Pick ONE item this person has never been sent. Matched on what we know about
 * them (their opener, the post they engaged with, any bio the agent supplies),
 * then rotated news -> guide -> router so a silent thread never gets the same
 * kind of message twice running.
 */
export function pickValueItem({ target, library, sentIds = [] }) {
  const sent = new Set(sentIds);
  const known = new Set(words([target.opener, target.caption, target.bio, target.hint].filter(Boolean).join(' ')));
  const rotation = ['news', 'guide', 'router'];
  const preferred = rotation[(Math.max(1, target.followUpNumber ?? 2) - 2 + rotation.length * 4) % rotation.length];
  let best = null;
  for (const item of library.items) {
    if (sent.has(item.id)) continue;
    const overlap = (item.tags ?? []).filter((t) => known.has(t)).length;
    let score = overlap * 3 + (item.type === preferred ? 1 : 0);
    if (item.type === 'news') score += Math.max(0, 14 - Math.max(0, ageDays(item.date, library.now))) / 100;
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item ?? null;
}

const countQuestions = (text) => (text.replace(URL_RE, '').match(/\?/g) ?? []).length;
const sentenceCount = (text) => text.replace(URL_RE, 'link').split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;

/**
 * Post-check. A draft is only sendable if it is short, human, carries the item
 * it was handed, and contains no empty check-in language.
 */
export function checkValueDraft(text, item, { linksBlocked = false } = {}) {
  const t = String(text ?? '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (BANNED_PHRASES.some((re) => re.test(t))) return { ok: false, reason: 'banned-phrase' };
  if (hasPlaceholder(t)) return { ok: false, reason: 'placeholder' };

  const urls = t.match(URL_RE) ?? [];
  if (urls.length) {
    const guideOk = item.type === 'guide' && !linksBlocked;
    const allowed = (u) => guideOk && u.replace(/[.,!]+$/, '') === item.url && ALLOWED_LINK_HOSTS.some((h) => u.includes(h));
    if (!urls.every(allowed)) return { ok: false, reason: 'link-not-allowed' };
  }
  if (/\$\s?\d/.test(t)) return { ok: false, reason: 'price' };
  if (countQuestions(t) > 1) return { ok: false, reason: 'too-many-questions' };
  if (sentenceCount(t) > 3 || t.split(/\s+/).length > 60) return { ok: false, reason: 'too-long' };

  const lower = t.toLowerCase();
  if (!(item.anchors ?? []).some((a) => lower.includes(a.toLowerCase()))) return { ok: false, reason: 'no-value-item' };
  return { ok: true };
}

function describeItem(item, linksBlocked) {
  if (item.type === 'news') {
    return `NEWS (${item.date}, source: ${new URL(item.url).hostname}): ${item.title}. Why a builder cares: ${item.why}. Name it specifically (the product or model name). Do NOT include any link.`;
  }
  if (item.type === 'guide') {
    return `FREE GUIDE: "${item.title}" from the Varritech Playbook, ${item.why}. ${linksBlocked ? 'Do NOT include a link; say you can send it if they reply.' : `Include this exact link once: ${item.url}`}`;
  }
  return `FREE ACCESS TO THE VARRITECH AI ROUTER: ${item.why}. Say the word "router". Offer free access if they reply. Do NOT include a link and do NOT mention any price.`;
}

export function buildValuePrompt({ target, item, linksBlocked, feedback = null }) {
  const lines = [
    'You are Cristiano, founder of Varritech, sending a short follow-up DM on Instagram.',
    `Person: @${target.handle}. What we know: ${[target.opener && `we opened with "${target.opener}"`, target.caption && `they engaged with a post about "${target.caption}"`, target.bio && `bio: ${target.bio}`].filter(Boolean).join('; ') || 'little, they engaged with our posts'}.`,
    `The ONE thing of value to give them: ${describeItem(item, linksBlocked)}`,
    'Write 1 to 3 short sentences, casual, like a person texting. Lead with the value, tie it to what they might be building if you can do that without guessing.',
    'At most one question, and only if it is natural. No emoji spam, no em dashes.',
    'Never say: hope it is going well, wishing you the best, just following up, checking in, no worries, door is always open. No pitch, no price.',
    'Write the FINAL text, never a placeholder like [niche] or {name}. Output only the message.',
  ];
  if (feedback) lines.push(`Your previous draft was rejected (${feedback}). Fix exactly that.`);
  return lines.join(' ');
}

const clean = (raw) => stripEmDashes(String(raw ?? '').trim()).replace(/^["']|["']$/g, '').trim();

/**
 * Draft one value follow-up. Regenerates once on a failed post-check; if the
 * second attempt fails too, returns skipped (the person is picked up again next
 * run, nothing is recorded) and logs why.
 */
export async function draftValueFollowUp({ target, library, sentIds = [], llm, linksBlocked = false, log = console.error }) {
  const item = pickValueItem({ target, library, sentIds });
  if (!item) {
    log(`[value] skip @${target.handle}: no-value-item-left`);
    return { text: '', skipped: true, reason: 'no-value-item-left' };
  }
  let feedback = null;
  let last = 'unknown';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let text;
    try {
      text = clean(await llm({ prompt: buildValuePrompt({ target, item, linksBlocked, feedback }), target }));
    } catch (err) {
      last = `llm-error: ${String(err?.message ?? err).slice(0, 120)}`;
      break;
    }
    const verdict = checkValueDraft(text, item, { linksBlocked });
    if (verdict.ok) return { text, valueId: item.id, skipped: false };
    last = verdict.reason;
    feedback = verdict.reason;
  }
  log(`[value] skip @${target.handle}: draft rejected (${last}) for ${item.id}`);
  return { text: '', skipped: true, reason: last };
}

/** Which library item does already-sent text carry? Null when none match. */
export function inferValueId(text, library) {
  const t = String(text ?? '').toLowerCase();
  const guideHit = GUIDES.find((g) => t.includes(g.url.toLowerCase()));
  if (guideHit) return guideHit.id;
  const hit = library.items.find((i) => (i.anchors ?? []).some((a) => t.includes(a.toLowerCase())));
  return hit?.id ?? null;
}

export function sentValueIds(entry) {
  return [...new Set([...(entry?.valueItems ?? []), ...(entry?.followUps ?? []).map((f) => f.valueId).filter(Boolean)])];
}

/** The daily-researched news, from state/value-library.json. Missing/corrupt file = no news (guides + router still go out). */
export function loadNews(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(parsed?.news) ? parsed.news : [];
  } catch {
    return [];
  }
}

/** Everything already sent to this person: explicit ids plus ones recoverable from the text of past knocks. */
export function priorValueIds(entry, library) {
  const ids = new Set(sentValueIds(entry));
  for (const f of entry?.followUps ?? []) {
    const id = inferValueId(f.text, library);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Merge freshly researched items into the stored set. Invalid (unsourced,
 * undated, no why-line) and expired items are DROPPED and reported, never kept.
 * Incoming wins over stored for the same id.
 */
export function mergeNews(existing, incoming, now = new Date()) {
  const dropped = [];
  const byId = new Map();
  for (const n of [...(existing ?? []), ...(incoming ?? [])]) {
    if (!isValidNewsItem(n)) { dropped.push({ id: n?.id ?? '?', reason: 'invalid' }); continue; }
    byId.set(n.id, n);
  }
  const all = [...byId.values()];
  const live = pruneNews(all, now);
  for (const n of all) if (!live.includes(n)) dropped.push({ id: n.id, reason: 'expired' });
  return { items: live, dropped };
}

export const newsIsStale = (fetchedOn, now = new Date()) => fetchedOn !== now.toISOString().slice(0, 10);

export function saveNews(path, items, now = new Date()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ fetchedOn: now.toISOString().slice(0, 10), news: items }, null, 2));
}

export function loadFetchedOn(path) {
  try { return JSON.parse(readFileSync(path, 'utf8'))?.fetchedOn; } catch { return undefined; }
}
