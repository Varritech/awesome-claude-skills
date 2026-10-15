// The lane's DevTools port, used for the two things the browser MCP cannot do
// on a non-default lane: put text into LinkedIn's contenteditable composer, and
// read a value back. browser_type only fills <input>/<textarea>, and
// browser_execute_js is a silent no-op on lanes b-e (Dia blocks it; see the
// browsermcp-enhanced-setup skill, Fault #7). Lane e exposes CDP on 9335 when
// launched with BROWSERMCP_LANE_CDP=1.

export async function cdpSession({ port = 9335, urlMatch = 'linkedin.com', fetchImpl = fetch } = {}) {
  let targets;
  try {
    targets = await (await fetchImpl(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    throw new Error(`lane DevTools port :${port} is closed. Lane e must be launched with BROWSERMCP_LANE_CDP=1`);
  }
  const page = targets.find((t) => t.type === 'page' && String(t.url).includes(urlMatch));
  if (!page) throw new Error(`no ${urlMatch} tab on DevTools :${port}`);
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
