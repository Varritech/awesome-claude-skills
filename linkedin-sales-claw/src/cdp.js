// The lane's DevTools port, used for the two things the browser MCP cannot do
// on a non-default lane: put text into LinkedIn's contenteditable composer, and
// read a value back. browser_type only fills <input>/<textarea>, and
// browser_execute_js is a silent no-op on lanes b-e (Dia blocks it; see the
// browsermcp-enhanced-setup skill, Fault #7). Lane e exposes CDP on 9335 when
// launched with BROWSERMCP_LANE_CDP=1.

export async function cdpSession({ port = 9335, urlMatch = 'linkedin.com', exactUrl = null, fetchImpl = fetch } = {}) {
  let targets;
  try {
    targets = await (await fetchImpl(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    throw new Error(`lane DevTools port :${port} is closed. Lane e must be launched with BROWSERMCP_LANE_CDP=1`);
  }
  // ⛔ With more than one LinkedIn tab open, "first linkedin tab" typed into a
  // DIFFERENT conversation than the one the MCP had just opened (2026-10-15:
  // Marc Koehl got a message addressed to Anshul). Callers that type must pass
  // the exact URL of the tab the MCP is driving.
  const pages = targets.filter((t) => t.type === 'page');
  const page = exactUrl
    ? pages.find((t) => t.url === exactUrl)
    : pages.find((t) => String(t.url).includes(urlMatch));
  if (!page) throw new Error(`no ${exactUrl ? `tab at ${exactUrl}` : `${urlMatch} tab`} on DevTools :${port}`);
  if (exactUrl && pages.filter((t) => t.url === exactUrl).length > 1) throw new Error(`two tabs at ${exactUrl}; refusing to guess`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools socket failed')); });
  let id = 0;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const my = ++id;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== my) return;
      ws.removeEventListener('message', onMsg);
      m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result?.value;
  return { send, evaluate, close: () => ws.close() };
}

export async function withCdp(fn, opts) {
  const s = await cdpSession(opts);
  try { return await fn(s); } finally { s.close(); }
}
