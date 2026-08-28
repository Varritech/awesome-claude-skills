// Anthropic seam. Injected everywhere else so tests never touch the network.
//
// ⛔ Identity-linked keys (minted against a user rather than a workspace) 400
// with "anthropic-workspace-id is required" on every /v1/messages call unless
// the workspace header rides along. Workspace-scoped keys must NOT send it.
export function anthropicLlm({ apiKey, model, workspaceId, fetchImpl = fetch }) {
  return async ({ prompt }) => {
    const headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  };
}
