// Low-level "hands" for the LinkedIn tab: find things, click them with a real
// mouse, type with the keyboard. Nothing here ever loads a URL.
//
// ⛔ Cristiano, 2026-10-15: "You shouldn't be leaving the site. You shouldn't be
// refreshing. You have to be clicking." Loading URLs directly made Chrome raise
// "Leave site?" over unsent drafts and froze the tab. LinkedIn also draws its
// whole interface (chat windows included) inside a same-origin /preload/ iframe,
// so page-level querySelector misses it; DOM.performSearch with pierce:true sees
// every frame, which is what find() uses.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectUi({ port = 9335, urlMatch = 'linkedin.com', fetchImpl = fetch } = {}) {
  let targets;
  try {
    targets = await (await fetchImpl(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    throw new Error(`lane DevTools port :${port} is closed. Lane e must be launched with BROWSERMCP_LANE_CDP=1`);
  }
  const pages = targets.filter((t) => t.type === 'page' && String(t.url).includes(urlMatch));
  if (pages.length !== 1) throw new Error(`expected exactly one LinkedIn tab in lane e, found ${pages.length}`);
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools socket failed')); });
  let id = 0;
  const send = (method, params = {}, timeoutMs = 15000) => new Promise((res, rej) => {
    const my = ++id;
    const timer = setTimeout(() => { ws.removeEventListener('message', onMsg); rej(new Error(`${method} timed out (page frozen? an open dialog?)`)); }, timeoutMs);
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== my) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMsg);
      m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: my, method, params }));
  });

  /** Run JS in the top document. */
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page script failed: ${r.exceptionDetails.text}`);
    return r.result?.value;
  };

  /** Every node matching a CSS selector, across all frames, with its on-screen centre. */
  async function find(selector) {
    await send('DOM.getDocument', { depth: -1, pierce: true });
    const s = await send('DOM.performSearch', { query: selector, includeUserAgentShadowDOM: true });
    const out = [];
    if (s.resultCount) {
      const r = await send('DOM.getSearchResults', { searchId: s.searchId, fromIndex: 0, toIndex: Math.min(s.resultCount, 60) });
      for (const nodeId of r.nodeIds) {
        let centre = null;
        try {
          const c = (await send('DOM.getBoxModel', { nodeId })).model.content;
          centre = { x: (c[0] + c[2]) / 2, y: (c[1] + c[5]) / 2, w: c[2] - c[0], h: c[5] - c[1] };
        } catch { /* not rendered */ }
        out.push({ nodeId, centre });
      }
      await send('DOM.discardSearchResults', { searchId: s.searchId }).catch(() => {});
    }
    return out;
  }

  /** Call fn(this) on a node; fn is a function source string. */
  async function on(nodeId, fn) {
    const o = await send('DOM.resolveNode', { nodeId });
    const r = await send('Runtime.callFunctionOn', { objectId: o.object.objectId, functionDeclaration: fn, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  }

  async function click(x, y) {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  }

  /** Scroll a node into view, then click its centre with the mouse. */
  async function clickNode(nodeId) {
    await on(nodeId, 'function(){ this.scrollIntoView({block:"center"}); }');
    await sleep(300);
    const c = (await send('DOM.getBoxModel', { nodeId })).model.content;
    await click((c[0] + c[2]) / 2, (c[1] + c[5]) / 2);
  }

  const type = (text) => send('Input.insertText', { text });
  const KEYS = { Enter: 13, Escape: 27, Backspace: 8 };
  async function key(name) {
    for (const t of ['rawKeyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type: t, key: name, code: name, windowsVirtualKeyCode: KEYS[name], ...(name === 'Enter' && t === 'rawKeyDown' ? { text: '\r' } : {}) });
    }
  }

  /** Cmd+A in the focused field. */
  async function selectAll() {
    for (const t of ['rawKeyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type: t, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 4, commands: t === 'rawKeyDown' ? ['selectAll'] : [] });
    }
  }

  /** Poll until find(selector) has a rendered node passing test(node); returns it or null. */
  async function waitFor(selector, test = async () => true, timeoutMs = 10000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      for (const n of await find(selector)) {
        if (n.centre && n.centre.w > 0 && (await test(n))) return n;
      }
      await sleep(500);
    }
    return null;
  }

  async function windowWidth() {
    const w = await evaluate('innerWidth');
    if (w >= 1150) return w;
    const { windowId } = await send('Browser.getWindowForTarget');
    await send('Browser.setWindowBounds', { windowId, bounds: { width: 1500, height: 1000, windowState: 'normal' } });
    return evaluate('innerWidth');
  }

  /**
   * Is LinkedIn's app actually drawn? (Blank main + no nav = crashed SPA.)
   * On /messaging pages LinkedIn draws the nav bar inside its /preload/ iframe,
   * so a top-document check alone called every Messaging page "crashed" and
   * reload-looped it (2026-10-16): fall back to a pierced search for the
   * My Network link at the top of the window.
   */
  async function healthy() {
    try {
      const main = await evaluate(`(document.querySelector('main')?.innerText || '').trim().length > 20`);
      if (!main) return false;
      const topNav = await evaluate(`[...document.querySelectorAll('a, button')].some((e) => (e.innerText || '').trim() === 'My Network' && e.getBoundingClientRect().top < 60)`);
      if (topNav) return true;
      return (await find('a[href*="/mynetwork/"]')).some((n) => n.centre && n.centre.w > 0 && n.centre.y < 80);
    } catch { return false; }
  }

  /**
   * ⛔ The ONE place a reload is allowed (Cristiano 2026-10-15: reload "only to
   * recover"): the page has crashed AND no message box holds text, so Chrome
   * cannot raise "Leave site?". Everything else stays click-only.
   */
  async function recoverIfCrashed() {
    if (await healthy()) return false;
    await sleep(4000);
    if (await healthy()) return false; // was just mid-render
    for (const ed of await find('.msg-form__contenteditable, [role=dialog] textarea')) {
      const text = await on(ed.nodeId, 'function(){ return (this.value ?? this.innerText ?? "").trim(); }').catch(() => '');
      if (text) throw new Error('page crashed with unsent text in a message box; not reloading. Needs Cristiano.');
    }
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: false });
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      await sleep(1500);
      if (await healthy()) return true;
    }
    throw new Error('LinkedIn did not recover after a reload');
  }

  return { healthy, recoverIfCrashed, send, evaluate, find, on, click, clickNode, type, key, selectAll, waitFor, windowWidth, sleep, close: () => ws.close() };
}
