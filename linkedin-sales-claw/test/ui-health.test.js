import { describe, it, expect, afterEach } from 'vitest';
import { connectUi } from '../src/ui.js';

// A fake lane-e tab behind a fake DevTools socket. `page` says what is drawn:
// main = LinkedIn's content area has text; topNav = the nav bar is in the top
// document; frameNav = the nav bar is only inside LinkedIn's /preload/ iframe
// (what every /messaging page looks like, 2026-10-16).
function fakeTab(page) {
  const sent = [];
  class FakeSocket {
    constructor() { this.listeners = []; setTimeout(() => this.onopen?.(), 0); }
    addEventListener(_, fn) { this.listeners.push(fn); }
    removeEventListener(_, fn) { this.listeners = this.listeners.filter((l) => l !== fn); }
    close() {}
    send(raw) {
      const { id, method, params } = JSON.parse(raw);
      sent.push(method);
      const result = reply(method, params);
      setTimeout(() => this.listeners.forEach((l) => l({ data: JSON.stringify({ id, result }) })), 0);
    }
  }
  function reply(method, params) {
    if (method === 'Runtime.evaluate') {
      const value = params.expression.includes('My Network') ? page.main && page.topNav : page.main;
      return { result: { value } };
    }
    if (method === 'DOM.performSearch') {
      const hit = params.query.includes('/mynetwork/') && (page.topNav || page.frameNav);
      return { searchId: 's1', resultCount: hit ? 1 : 0 };
    }
    if (method === 'DOM.getSearchResults') return { nodeIds: [7] };
    if (method === 'DOM.getBoxModel') return { model: { content: [400, 10, 460, 10, 460, 40, 400, 40] } };
    return {};
  }
  globalThis.WebSocket = FakeSocket;
  const fetchImpl = async () => ({ json: async () => [{ type: 'page', url: 'https://www.linkedin.com/messaging/thread/x/', webSocketDebuggerUrl: 'ws://fake' }] });
  return { sent, fetchImpl };
}

const realWebSocket = globalThis.WebSocket;
afterEach(() => { globalThis.WebSocket = realWebSocket; });

describe('page health check', () => {
  it('counts a Messaging page as healthy when the nav bar is drawn inside the iframe', async () => {
    const { fetchImpl } = fakeTab({ main: true, topNav: false, frameNav: true });
    const u = await connectUi({ fetchImpl });
    expect(await u.healthy()).toBe(true);
  });

  it('does not reload a Messaging page that is fine', async () => {
    const { sent, fetchImpl } = fakeTab({ main: true, topNav: false, frameNav: true });
    const u = await connectUi({ fetchImpl });
    expect(await u.recoverIfCrashed()).toBe(false);
    expect(sent).not.toContain('Page.reload');
  });

  it('still calls the page crashed when no nav bar is drawn anywhere', async () => {
    const { fetchImpl } = fakeTab({ main: true, topNav: false, frameNav: false });
    const u = await connectUi({ fetchImpl });
    expect(await u.healthy()).toBe(false);
  });

  it('still calls the page crashed when the content area is blank', async () => {
    const { fetchImpl } = fakeTab({ main: false, topNav: true, frameNav: true });
    const u = await connectUi({ fetchImpl });
    expect(await u.healthy()).toBe(false);
  });

  it('counts the normal top-document nav as healthy', async () => {
    const { fetchImpl } = fakeTab({ main: true, topNav: true, frameNav: false });
    const u = await connectUi({ fetchImpl });
    expect(await u.healthy()).toBe(true);
  });
});
