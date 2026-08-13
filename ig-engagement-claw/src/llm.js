// Anthropic seam. Injected everywhere else so tests never touch the network.
export function anthropicLlm({ apiKey, model, fetchImpl = fetch }) {
  return async ({ prompt }) => {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
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
