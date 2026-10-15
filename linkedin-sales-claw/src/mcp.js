// A browser MCP lane, driven directly over Streamable HTTP.
//
// The claw talks to its OWN lane (default browsermcp-e on :3005, reserved for
// LinkedIn in ~/.browsermcp-lanes/reserved/e) so it never fights an interactive
// session or the Instagram claw for the active tab. Node calling the tools
// itself, instead of an agent copying tool output into files, removes the
// hand-retyped-scrape failure the IG claw logged dozens of times.

export function createMcpClient({ url, fetchImpl = fetch }) {
  let sessionId = null;
  let nextId = 1;

  async function rpc(method, params, { notify = false } = {}) {
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    if (!notify) body.id = nextId++;
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) sessionId = sid;
    if (notify) return null;
    const raw = await res.text();
    if (!res.ok) throw new Error(`mcp ${method} ${res.status}: ${raw.slice(0, 300)}`);
    const dataLines = raw.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
    const msg = JSON.parse(dataLines.length ? dataLines[dataLines.length - 1] : raw);
    if (msg.error) throw new Error(`mcp ${method}: ${msg.error.message}`);
    return msg.result;
  }

  async function init() {
    if (sessionId) return;
    await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'linkedin-sales-claw', version: '0.1.0' } });
    await rpc('notifications/initialized', null, { notify: true });
  }

  /** Call a tool and return its text content joined. Throws on isError. */
  async function call(name, args = {}) {
    await init();
    const result = await rpc('tools/call', { name, arguments: args });
    const text = (result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (result?.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
    return text;
  }

  return { call, init };
}
