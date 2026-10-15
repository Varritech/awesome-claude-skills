// The real LinkedIn, driven through the claw's own browser MCP lane (e).
// Implements the `browser` interface src/pipeline.js is tested against.

import { createMcpClient } from './mcp.js';
import { withCdp } from './cdp.js';
import { parseSearchResults, parseConnections, parseThread } from './linkedin-dom.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const COMPOSER = 'div.msg-form__contenteditable';
const SEND_BTN = 'button.msg-form__send-button';

// Pages LinkedIn shows instead of the one we asked for. Any of these = stop the run.
const BLOCKERS = [/\/login/, /\/checkpoint\//, /\/authwall/, /uas\/login/];
const LIMIT_RE = /weekly invitation limit|reached the (?:weekly|monthly) limit|too many requests|unusual activity/i;

export function createLinkedInBrowser({ mcpUrl = 'http://127.0.0.1:3005/mcp', cdpPort = 9335, me = 'Cristiano Varriale', pause = 4000 } = {}) {
  const mcp = createMcpClient({ url: mcpUrl });

  async function go(url, wait = pause) {
    const res = await mcp.call('browser_navigate', { action: 'goto', url, snapshot: false });
    await sleep(wait);
    const landed = /URL: (\S+)/.exec(await mcp.call('browser_snapshot', { level: 'scaffold' }))?.[1] ?? '';
    if (BLOCKERS.some((re) => re.test(landed))) throw new Error(`LinkedIn blocked the session (landed on ${landed}). A human needs to sign in / clear the checkpoint in lane e.`);
    return res;
  }

  async function html(selector = 'main') {
    const raw = await mcp.call('browser_extract_html', { selector, mode: 'html' });
    return raw;
  }

  async function snapshotText() {
    return mcp.call('browser_snapshot', { level: 'minimal' });
  }

  const refFor = (snap, label) => new RegExp(`\\[ref=(ref\\d+)\\] "${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).exec(snap)?.[1] ?? null;

  /** Window must be wide or LinkedIn hides the conversation pane. */
  async function preflight() {
    await mcp.call('browser_tab', { action: 'list' });
    const width = await withCdp(async (c) => {
      const w = await c.evaluate('innerWidth');
      if (w >= 1200) return w;
      const { windowId } = await c.send('Browser.getWindowForTarget');
      await c.send('Browser.setWindowBounds', { windowId, bounds: { width: 1500, height: 1000, windowState: 'normal' } });
      return c.evaluate('innerWidth');
    }, { port: cdpPort });
    await go('https://www.linkedin.com/feed/', 3000);
    return { width };
  }

  async function searchPage(searchUrl, page) {
    const u = new URL(searchUrl);
    if (page > 1) u.searchParams.set('page', String(page));
    await go(u.toString());
    return parseSearchResults(await html('main'));
  }

  async function sendInvite(slug) {
    await go(`https://www.linkedin.com/preload/search-custom-invite/?vanityName=${encodeURIComponent(slug)}`, 3500);
    const snap = await snapshotText();
    if (LIMIT_RE.test(snap)) throw new Error(`invite limit hit: ${slug}`);
    const ref = refFor(snap, 'Send without a note');
    if (!ref) return false; // no dialog: already pending/connected, or the button moved
    await mcp.call('browser_click', { ref, element: 'Send without a note' });
    await sleep(2500);
    const after = await snapshotText();
    if (LIMIT_RE.test(after)) throw new Error(`invite limit hit: ${slug}`);
    // Read back from the profile: the button must now say Pending.
    await go(`https://www.linkedin.com/in/${encodeURIComponent(slug)}/`, 3500);
    return /"Pending"|Pending, click to withdraw/i.test(await snapshotText());
  }

  async function connections() {
    await go('https://www.linkedin.com/mynetwork/invite-connect/connections/');
    return parseConnections(await html('main'));
  }

  async function readThread({ recipient }) {
    await go(`https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(recipient)}`, 5000);
    return parseThread(await html('main'), { me });
  }

  /** Type, send, then read the thread back. True only if our text is there. */
  async function sendMessage({ recipient, text }) {
    const before = await readThread({ recipient });
    const typed = await withCdp(async (c) => {
      const focused = await c.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(COMPOSER)}); if (!el) return false; el.focus(); document.execCommand('selectAll'); document.execCommand('delete'); return document.activeElement === el; })()`);
      if (!focused) throw new Error('message composer not found (window too narrow, or no messaging permission)');
      await c.send('Input.insertText', { text });
      const got = await c.evaluate(`document.querySelector(${JSON.stringify(COMPOSER)}).innerText`);
      if (norm(got) !== norm(text)) return false;
      return c.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(SEND_BTN)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
    }, { port: cdpPort });
    if (!typed) return false;
    await sleep(3000);
    const after = await readThread({ recipient });
    const ours = after.filter((m) => m.from === 'us');
    return ours.length > before.filter((m) => m.from === 'us').length && norm(ours.at(-1).text) === norm(text);
  }

  return { preflight, searchPage, sendInvite, connections, readThread, sendMessage };
}
