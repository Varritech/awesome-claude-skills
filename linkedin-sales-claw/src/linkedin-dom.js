// Parsers for LinkedIn pages, fed the raw HTML the browser MCP's
// browser_extract_html returns.
//
// LinkedIn's class names are generated (hv4lg2...) and change between deploys,
// so nothing here keys on a class. It flattens the page to an ordered stream
// of text segments and link markers, then reads cards by the things that are
// stable: /in/<slug>/ profile links, the "• 2nd" degree badge, and the
// search-custom-invite Connect link.

import { slugOf } from './handle.js';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

function unwrap(html) {
  const s = String(html ?? '');
  if (s.trimStart().startsWith('"')) {
    try { return JSON.parse(s); } catch { /* fall through */ }
  }
  return s;
}

/** HTML -> [{ text } | { href }] in document order. */
export function flatten(html) {
  const out = [];
  const src = unwrap(html).replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const re = /<a\b[^>]*?href="([^"]*)"[^>]*>|<[^>]+>|([^<]+)/gi;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) out.push({ href: decode(m[1]) });
    else if (m[2] !== undefined) {
      const text = decode(m[2]).replace(/\s+/g, ' ').trim();
      if (text) out.push({ text });
    }
  }
  return out;
}

const DEGREE_RE = /^•\s*(1st|2nd|3rd\+?)$/;
const isProfile = (href) => /linkedin\.com\/in\/|^\/in\//.test(href ?? '');
const inviteSlug = (href) => {
  const m = /search-custom-invite\/\?vanityName=([^&]+)/.exec(href ?? '');
  return m ? slugOf(decodeURIComponent(m[1])) : null;
};

const recipientOf = (href) => {
  const m = /[?&]recipient=([^&]+)/.exec(href ?? '');
  return m ? decodeURIComponent(m[1]) : null;
};

export function parseSearchResults(html) {
  const seq = flatten(html);
  const cards = [];
  let lastProfile = null; // { slug, name }
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s.href && isProfile(s.href)) {
      // A card links the photo and the name to the same profile; only the
      // name link is followed by text.
      const slug = slugOf(s.href);
      const next = seq[i + 1];
      const name = next?.text && !DEGREE_RE.test(next.text) ? next.text : null;
      lastProfile = { slug, name: name ?? (lastProfile?.slug === slug ? lastProfile.name : null) };
      continue;
    }
    const deg = s.text && DEGREE_RE.exec(s.text);
    if (deg && lastProfile) {
      const texts = [];
      for (let j = i + 1; j < seq.length && texts.length < 2; j++) {
        if (seq[j].href) break;
        texts.push(seq[j].text);
      }
      cards.push({ slug: lastProfile.slug, name: lastProfile.name, degree: deg[1], headline: texts[0] ?? '', location: texts[1] ?? '', canConnect: false });
      continue;
    }
    const inv = inviteSlug(s.href);
    if (inv) {
      const card = cards.find((c) => c.slug === inv);
      if (card) card.canConnect = true;
      continue;
    }
    // 1st-degree cards carry a Message link instead of Connect.
    const rec = recipientOf(s.href);
    if (rec && cards.length && !cards.at(-1).recipient) cards.at(-1).recipient = rec;
  }
  return cards;
}

const CONNECTED_RE = /^Connected on (.+)$/;

/** My Network > Connections, sorted "Recently added". */
export function parseConnections(html) {
  const seq = flatten(html);
  const rows = [];
  let cur = null;
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s.href && isProfile(s.href)) {
      const slug = slugOf(s.href);
      if (!cur || cur.slug !== slug) {
        cur = { slug, name: null, headline: '', connectedOn: null, recipient: null };
        rows.push(cur);
      }
      const next = seq[i + 1];
      if (!cur.name && next?.text) cur.name = next.text;
      continue;
    }
    if (!cur) continue;
    const rec = recipientOf(s.href);
    if (rec) { cur.recipient = rec; continue; }
    if (!s.text || s.text === cur.name || s.text === '.' || s.text === 'Message') continue;
    const c = CONNECTED_RE.exec(s.text);
    if (c) cur.connectedOn = c[1];
    else if (!cur.connectedOn && !cur.headline) cur.headline = s.text;
  }
  return rows.filter((r) => r.connectedOn);
}

const GROUP_RE = /^(.+?) sent the following messages? at /;
const TIME_RE = /^\d{1,2}:\d{2}\s?(?:AM|PM)$/i;
const NOISE = new Set(['👏', '👍', '😊', 'Open Emoji Keyboard', '(He/Him)', '(She/Her)', '(They/Them)']);
const DATE_SEP_RE = /^(?:Today|Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2} \d{1,2}(?:, \d{4})?)$/;
const THREAD_END_RE = /^(?:Drag your file here\.|Send|Write a message…)$/;

/**
 * One open conversation -> [{ from: 'us'|'them', name, text }], oldest first.
 * A message starts at the sender's "View X's profile" link and its body is the
 * text after the reaction bar ("Open Emoji Keyboard").
 */
export function parseThread(html, { me }) {
  const seq = flatten(html);
  const out = [];
  let sender = null;
  let body = null; // array of text parts while inside a message body
  let inBodyZone = false;
  const close = () => {
    if (body && body.length) out.push({ from: sender === me ? 'us' : 'them', name: sender, text: body.join('\n') });
    body = null;
    inBodyZone = false;
  };
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s.text && THREAD_END_RE.test(s.text)) { close(); break; }
    const g = s.text && GROUP_RE.exec(s.text);
    if (g) { close(); sender = g[1]; continue; }
    if (!sender) continue;
    if (s.href) {
      if (isProfile(s.href) && inBodyZone) close();
      continue;
    }
    if (s.text === 'Open Emoji Keyboard') { body = []; inBodyZone = true; continue; }
    if (!inBodyZone || NOISE.has(s.text) || TIME_RE.test(s.text)) continue;
    // A bare date heading between groups ("Today", "Sep 19") is furniture,
    // but only when the next thing is a new group header.
    const nextText = seq.slice(i + 1).find((x) => x.text)?.text ?? '';
    if (DATE_SEP_RE.test(s.text) && GROUP_RE.test(nextText)) continue;
    body.push(s.text);
  }
  close();
  return out;
}
