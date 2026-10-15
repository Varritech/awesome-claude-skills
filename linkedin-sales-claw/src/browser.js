// The real LinkedIn, driven like a person: click the search box, type, press
// Enter, click filters, click Message on a card, type in the chat window, click
// Send, read it back, close the window. It never loads or refreshes a URL
// (Cristiano 2026-10-15, after "Leave site?" froze the tab), and it never moves
// on with text still in a message box.
//
// Implements the `browser` interface src/pipeline.js is tested against.

import { connectUi } from './ui.js';
import { parseSearchResults, parseThread, parseConnections } from './linkedin-dom.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const LIMIT_RE = /weekly invitation limit|reached the (?:weekly|monthly) limit|too many requests|unusual activity/i;
const BLOCKED_RE = /\/(?:login|checkpoint|authwall)|uas\/login/;

// Search results live in the top document; everything below finds and clicks there.
const CARD_OF = (needle) => `(() => {
  const links = [...document.querySelectorAll('main a[href*="/in/"]')].filter((a) => a.href.includes('/in/' + ${JSON.stringify(needle)} + '/') || a.href.endsWith('/in/' + ${JSON.stringify(needle)}));
  for (const a of links) { let n = a; for (let i = 0; i < 12 && n; i++) { n = n.parentElement; if (n && n.querySelectorAll('a[href*="/messaging/compose/"], a[href*="search-custom-invite"]').length === 1) return n; } }
  return null; })()`;

export function createLinkedInBrowser({ cdpPort = 9335, me = 'Cristiano Varriale' } = {}) {
  let ui = null;
  let currentSearch = null; // { key, page }

  async function hands() {
    if (!ui) ui = await connectUi({ port: cdpPort });
    return ui;
  }

  /** Click the element a top-document expression returns. False if not found. */
  async function clickTop(expr) {
    const u = await hands();
    const box = await u.evaluate(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); return true; })()`);
    if (!box) return false;
    await u.sleep(350);
    const r = await u.evaluate(`(() => { const el = ${expr}; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; })()`);
    if (!r || !r.w) return false;
    await u.click(r.x, r.y);
    return true;
  }

  async function waitTop(expr, timeoutMs = 10000) {
    const u = await hands();
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (await u.evaluate(`!!(${expr})`)) return true;
      await u.sleep(500);
    }
    return false;
  }

  async function checkSession() {
    const u = await hands();
    const href = await u.evaluate('location.href');
    if (BLOCKED_RE.test(href)) throw new Error(`LinkedIn signed out or checkpoint (${href}). Needs Cristiano in lane e.`);
    return href;
  }

  // ── chat windows (inside LinkedIn's /preload/ iframe: pierce search) ──────

  const labelOf = (u, n) => u.on(n.nodeId, 'function(){ return this.getAttribute("aria-label") || this.innerText || ""; }');

  /** The open chat window for `name`: its composer + send button + container html. */
  async function bubbleFor(name) {
    const u = await hands();
    for (const ed of await u.find('.msg-form__contenteditable')) {
      if (!ed.centre || !ed.centre.w) continue;
      const info = await u.on(ed.nodeId, `function(){
        let n = this; for (let i = 0; i < 30 && n; i++) { n = n.parentElement; if (n && /msg-overlay-conversation-bubble(\\s|$)/.test(n.className || '')) break; }
        if (!n) return null;
        const labels = [...n.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
        return { labels, html: n.outerHTML, box: this.innerText };
      }`);
      if (!info) continue;
      const mine = info.labels.some((l) => l === `Remove ${name}` || l.includes(`conversation with ${name}`));
      if (mine) return { composer: ed, ...info };
    }
    return null;
  }

  async function sendButtonIn(name) {
    const u = await hands();
    for (const b of await u.find('button.msg-form__send-button')) {
      if (!b.centre || !b.centre.w) continue;
      const ok = await u.on(b.nodeId, `function(){
        let n = this; for (let i = 0; i < 30 && n; i++) { n = n.parentElement; if (n && /msg-overlay-conversation-bubble(\\s|$)/.test(n.className || '')) break; }
        if (!n) return false;
        return [...n.querySelectorAll('[aria-label]')].some((e) => { const l = e.getAttribute('aria-label'); return l === 'Remove ' + ${JSON.stringify(name)} || l.includes('conversation with ' + ${JSON.stringify(name)}); });
      }`);
      if (ok) return b;
    }
    return null;
  }

  async function clearComposer(name) {
    const u = await hands();
    const b = await bubbleFor(name);
    if (!b || !norm(b.box)) return;
    await u.on(b.composer.nodeId, 'function(){ this.focus(); document.execCommand("selectAll"); document.execCommand("delete"); }');
  }

  async function closeBubble(name) {
    const u = await hands();
    for (const c of await u.find('.msg-overlay-bubble-header__control')) {
      if (!c.centre || !c.centre.w) continue;
      const l = await labelOf(u, c);
      if (/^Close your (conversation|draft)/.test(l) && (l.includes(name) || l.includes(name.split(/[ ,]/)[0]))) {
        await u.click(c.centre.x, c.centre.y);
        await u.sleep(800);
      }
    }
  }

  /** Close every open chat window (start each person from a clean screen). */
  async function closeAllBubbles() {
    const u = await hands();
    for (let round = 0; round < 6; round++) {
      let closed = false;
      for (const c of await u.find('.msg-overlay-bubble-header__control')) {
        if (!c.centre || !c.centre.w) continue;
        if (/^Close your (conversation|draft)/.test(await labelOf(u, c))) {
          // Never close a window with unsent text: clear it first.
          await u.on(c.nodeId, `function(){ let n=this; for (let i=0;i<30&&n;i++){ n=n.parentElement; if (n && /msg-overlay-conversation-bubble(\\s|$)/.test(n.className||'')) break; } const ed = n && n.querySelector('.msg-form__contenteditable'); if (ed && ed.innerText.trim()) { ed.focus(); document.execCommand('selectAll'); document.execCommand('delete'); } }`);
          await u.click(c.centre.x, c.centre.y);
          await u.sleep(700);
          closed = true;
          break;
        }
      }
      if (!closed) return;
    }
  }

  // ── search ─────────────────────────────────────────────────────────────

  const specKey = (s) => JSON.stringify([s.keywords, s.network, s.location ?? null]);

  async function runSearch(spec) {
    const u = await hands();
    await closeAllBubbles();
    const box = 'document.querySelector(\'input[placeholder*="looking for"], input.search-global-typeahead__input\')';
    if (!(await clickTop(box))) throw new Error('LinkedIn search box not found');
    await u.sleep(400);
    await u.selectAll();
    await u.type(spec.keywords);
    await u.sleep(300);
    if (norm(await u.evaluate(`${box}.value`)) !== norm(spec.keywords)) throw new Error('could not type into the search box');
    await u.key('Enter');
    // Wait for THIS search, not the results page we may already be on.
    const kwMatch = `location.pathname.startsWith("/search/results/") && new URLSearchParams(location.search).get("keywords") === ${JSON.stringify(spec.keywords)}`;
    if (!(await waitTop(kwMatch, 12000))) throw new Error(`search for "${spec.keywords}" did not open`);
    await u.sleep(1500);
    // People tab
    if (!(await waitTop('location.pathname.startsWith("/search/results/people")', 1500))) {
      await waitTop('[...document.querySelectorAll("button, a, label")].find((e) => (e.innerText || "").trim() === "People")');
      await clickTop('[...document.querySelectorAll("button, a, label")].find((e) => (e.innerText || "").trim() === "People")');
      if (!(await waitTop('location.pathname.startsWith("/search/results/people")'))) throw new Error('People filter did not apply');
    }
    // Connection degree pills: set each to exactly what the spec wants. A click
    // while results re-render can be lost, so re-read every checkbox and repeat.
    const DEG = { '1st': 'Filter by 1st connections', '2nd': 'Filter by 2nd connections', '3rd+': 'Filter by 3rd+ connections' };
    await waitTop(`document.querySelector('input[aria-label="${DEG['1st']}"]')`, 8000);
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const [deg, aria] of Object.entries(DEG)) {
        const want = (spec.network ?? []).includes(deg);
        const has = await u.evaluate(`!!document.querySelector('input[aria-label="${aria}"]')?.checked`);
        if (want === has) continue;
        await clickTop(`[...document.querySelectorAll("label")].find((e) => (e.innerText || "").trim() === ${JSON.stringify(deg)})`);
        await waitTop(`!!document.querySelector('input[aria-label="${aria}"]')?.checked === ${want}`, 6000);
        await u.sleep(2000);
        changed = true;
      }
      if (!changed) break;
    }
    if (spec.location) await applyLocation(spec.location);
    await waitTop('document.querySelector(\'main a[href*="/in/"]\')', 10000);
    currentSearch = { key: specKey(spec), page: 1 };
  }

  async function applyLocation(place) {
    const u = await hands();
    // Let the pills render first: they read "Locations", or the place if already applied.
    await waitTop(`[...document.querySelectorAll("label")].some((e) => ["Locations", ${JSON.stringify(place)}].includes((e.innerText || "").trim()))`, 8000);
    // Already applied (LinkedIn carries filters into the next search): the pill reads the place.
    if (await u.evaluate(`location.search.includes("geoUrn") && [...document.querySelectorAll("label")].some((e) => (e.innerText || "").trim() === ${JSON.stringify(place)})`)) return;
    // Locations is a filter pill (LABEL); the dropdown has an input, suggestions
    // as role=option, and a "Show results" control that actually applies it.
    const pill = '[...document.querySelectorAll("label, button")].find((e) => (e.innerText || "").trim() === "Locations")';
    if (!(await clickTop(pill))) throw new Error('Locations filter not found');
    const input = 'document.querySelector(\'input[placeholder="Add a location"]\')';
    if (!(await waitTop(input, 5000))) throw new Error('location input did not open');
    await clickTop(input);
    await u.sleep(300);
    await u.type(place);
    const option = `[...document.querySelectorAll('[role="option"]')].find((o) => (o.innerText || "").trim() === ${JSON.stringify(place)})`;
    if (!(await waitTop(option, 6000))) throw new Error(`no "${place}" suggestion`);
    await clickTop(option);
    await u.sleep(800);
    const show = '[...document.querySelectorAll("*")].filter((e) => (e.innerText || "").trim() === "Show results" && e.getBoundingClientRect().height > 0).pop()';
    if (!(await waitTop(show, 4000))) throw new Error('Show results not found');
    await clickTop(show);
    if (!(await waitTop('location.search.includes("geoUrn")', 8000))) throw new Error(`location "${place}" did not apply`);
    await u.sleep(1500);
  }

  async function clickNext() {
    const u = await hands();
    const next = '[...document.querySelectorAll("button")].find((b) => /^Next$/.test((b.innerText || "").trim()) && !b.disabled)';
    const before = await u.evaluate('location.search');
    if (!(await clickTop(next))) return false;
    return waitTop(`location.search !== ${JSON.stringify(before)}`, 8000);
  }

  async function cardsOnPage() {
    const u = await hands();
    await waitTop('document.querySelector(\'main a[href*="/in/"]\')', 8000);
    return parseSearchResults(await u.evaluate('document.querySelector("main")?.outerHTML || ""'));
  }

  // ── the `browser` interface ────────────────────────────────────────────

  async function preflight() {
    const u = await hands();
    await checkSession();
    const width = await u.windowWidth();
    await closeAllBubbles();
    return { width };
  }

  /** spec = { keywords, network: ['1st'] | ['2nd','3rd+'], location? } */
  async function searchPage(spec, page) {
    await checkSession();
    if (!currentSearch || currentSearch.key !== specKey(spec) || currentSearch.page > page) await runSearch(spec);
    while (currentSearch.page < page) {
      if (!(await clickNext())) return [];
      currentSearch.page += 1;
    }
    return cardsOnPage();
  }

  /** Open a chat window with someone: their card on screen, else a search for their name. */
  async function openChat({ slug, name }) {
    const u = await hands();
    await closeAllBubbles();
    const msgOnCard = `(${CARD_OF(slug)})?.querySelector('a[href*="/messaging/compose/"]')`;
    if (!(await u.evaluate(`!!(${msgOnCard})`))) {
      await runSearch({ keywords: name.split(',')[0], network: ['1st'] });
      if (!(await waitTop(msgOnCard, 6000))) throw new Error(`could not find ${name}'s card to message`);
    }
    await clickTop(msgOnCard);
    const until = Date.now() + 10000;
    while (Date.now() < until) {
      const b = await bubbleFor(name);
      if (b) return b;
      await u.sleep(600);
    }
    throw new Error(`chat window with ${name} did not open`);
  }

  async function readThread({ slug, name }) {
    if (!name) throw new Error('readThread needs a name');
    const b = await openChat({ slug, name });
    await (await hands()).sleep(1200); // let older messages render
    const fresh = (await bubbleFor(name)) ?? b;
    return parseThread(fresh.html, { me });
  }

  /** Type, click Send, read the window back. True only if our text is the newest message from us. */
  async function sendMessage({ slug, name, text }) {
    if (!name) throw new Error('sendMessage needs the recipient name');
    const u = await hands();
    const before = await readThread({ slug, name });
    const b = await bubbleFor(name);
    if (!b) throw new Error(`chat window with ${name} is not open`);
    if (norm(b.box)) await clearComposer(name);
    try {
      await u.clickNode(b.composer.nodeId);
      await u.type(text);
      await u.sleep(500);
      const typed = await bubbleFor(name);
      if (!typed || norm(typed.box) !== norm(text)) return false;
      const send = await sendButtonIn(name);
      if (!send || (await u.on(send.nodeId, 'function(){ return this.disabled; }'))) return false;
      await u.click(send.centre.x, send.centre.y);
      await u.sleep(2500);
      const after = await bubbleFor(name);
      const msgs = after ? parseThread(after.html, { me }) : [];
      const ours = msgs.filter((m) => m.from === 'us');
      return ours.length > before.filter((m) => m.from === 'us').length && norm(ours.at(-1).text) === norm(text);
    } finally {
      // Whatever happened, nothing unsent stays in the box.
      await clearComposer(name).catch(() => {});
      await closeBubble(name).catch(() => {});
    }
  }

  /** Buttons of the open dialog (it lives in LinkedIn's iframe): [{ nodeId, centre, label }]. */
  async function dialogButtons() {
    const u = await hands();
    const out = [];
    for (const n of await u.find('[role=dialog] button')) {
      if (!n.centre || !n.centre.w) continue;
      out.push({ ...n, label: norm(await u.on(n.nodeId, 'function(){ return this.getAttribute("aria-label") || this.innerText || ""; }')), disabled: await u.on(n.nodeId, 'function(){ return !!this.disabled; }') });
    }
    return out;
  }

  async function dialogText() {
    const u = await hands();
    const d = (await u.find('[role=dialog]')).find((n) => n.centre && n.centre.w);
    return d ? norm(await u.on(d.nodeId, 'function(){ return this.innerText; }')) : '';
  }

  async function dismissDialog() {
    const u = await hands();
    for (let i = 0; i < 3; i++) {
      const btns = await dialogButtons();
      if (!btns.length) return;
      const x = btns.find((b) => b.label === 'Dismiss') ?? btns.find((b) => /^Cancel/.test(b.label));
      if (!x) return;
      await u.click(x.centre.x, x.centre.y);
      await u.sleep(800);
    }
  }

  /**
   * Click Connect on their card, add the note, click Send invitation.
   * -> { ok, noted }; ok only once the card itself reads Pending.
   */
  async function sendInvite(slug, { note = null } = {}) {
    const u = await hands();
    await closeAllBubbles();
    const connect = `(${CARD_OF(slug)})?.querySelector('a[href*="search-custom-invite"]')`;
    if (!(await u.evaluate(`!!(${connect})`))) return { ok: false, noted: false }; // not on this page / already pending
    await clickTop(connect);
    let btns = [];
    for (let i = 0; i < 16 && !btns.length; i++) { await u.sleep(500); btns = await dialogButtons(); }
    if (!btns.length) return { ok: false, noted: false };
    try {
      if (LIMIT_RE.test(await dialogText())) throw new Error(`invite limit hit: ${slug}`);
      let noted = false;
      const add = btns.find((b) => b.label === 'Add a note');
      if (note && add) {
        await u.click(add.centre.x, add.centre.y);
        const ta = await u.waitFor('[role=dialog] textarea', async () => true, 5000);
        if (ta) {
          await u.clickNode(ta.nodeId);
          await u.type(note);
          await u.sleep(400);
          const val = await u.on(ta.nodeId, 'function(){ return this.value; }');
          const send = (await dialogButtons()).find((b) => b.label === 'Send invitation' && !b.disabled);
          if (norm(val) === norm(note) && send) {
            await u.click(send.centre.x, send.centre.y);
            noted = true;
          } else {
            await dismissDialog();
            return { ok: false, noted: false };
          }
        }
      }
      if (!noted) {
        const plain = (await dialogButtons()).find((b) => b.label === 'Send without a note');
        if (!plain) { await dismissDialog(); return { ok: false, noted: false }; }
        await u.click(plain.centre.x, plain.centre.y);
      }
      await u.sleep(2500);
      if (LIMIT_RE.test(await dialogText())) throw new Error(`invite limit hit: ${slug}`);
      // Read back from the card on screen: it must now say Pending.
      const pending = await u.evaluate(`/\bPending\b/.test((${CARD_OF(slug)})?.innerText || "") || !!(${CARD_OF(slug)})?.querySelector('[aria-label^="Pending"]')`);
      return { ok: pending, noted: pending && noted };
    } finally {
      await dismissDialog().catch(() => {});
    }
  }

  /** My Network > Connections, reached by clicking. */
  async function connections() {
    const u = await hands();
    await closeAllBubbles();
    await clickTop('[...document.querySelectorAll("a[href]")].find((a) => /linkedin\\.com\\/mynetwork\\/?(\\?|$)/.test(a.href))');
    await waitTop('location.pathname.startsWith("/mynetwork")', 8000);
    const link = '[...document.querySelectorAll("a[href]")].find((a) => a.href.includes("/mynetwork/invite-connect/connections"))';
    if (!(await waitTop(link, 8000))) throw new Error('Connections link not found on My Network');
    await clickTop(link);
    if (!(await waitTop('location.pathname.startsWith("/mynetwork/invite-connect/connections")', 8000))) throw new Error('Connections page did not open');
    await waitTop('document.querySelector(\'main a[href*="/messaging/compose/"]\')', 10000);
    currentSearch = null;
    return parseConnections(await u.evaluate('document.querySelector("main")?.outerHTML || ""'));
  }

  return { preflight, searchPage, openChat, readThread, sendMessage, sendInvite, connections, closeAllBubbles, cardsOnPage, clickTop, waitTop, hands };
}
