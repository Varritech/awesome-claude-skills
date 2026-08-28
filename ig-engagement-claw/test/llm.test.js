import { describe, it, expect } from 'vitest';
import { anthropicLlm } from '../src/llm.js';

const okResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: 'text', text: 'drafted' }] }),
});

const capture = () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return okResponse();
  };
  return { calls, fetchImpl };
};

describe('anthropicLlm', () => {
  it('sends anthropic-workspace-id when a workspace is configured', async () => {
    // Identity-linked keys (sk-ant-api03 minted against a user, not a
    // workspace) 400 with "anthropic-workspace-id is required" unless the
    // header is present. See reference_anthropic_identity_linked_key_workspace_header.
    const { calls, fetchImpl } = capture();
    const llm = anthropicLlm({ apiKey: 'k', model: 'm', workspaceId: 'wrkspc_abc', fetchImpl });
    await llm({ prompt: 'hi' });
    expect(calls[0].init.headers['anthropic-workspace-id']).toBe('wrkspc_abc');
  });

  it('omits the header entirely when no workspace is configured', async () => {
    const { calls, fetchImpl } = capture();
    const llm = anthropicLlm({ apiKey: 'k', model: 'm', fetchImpl });
    await llm({ prompt: 'hi' });
    expect('anthropic-workspace-id' in calls[0].init.headers).toBe(false);
  });

  it('throws with the status and body on a non-2xx', async () => {
    const fetchImpl = async () => ({ ok: false, status: 400, text: async () => 'boom' });
    const llm = anthropicLlm({ apiKey: 'k', model: 'm', fetchImpl });
    await expect(llm({ prompt: 'hi' })).rejects.toThrow(/anthropic 400: boom/);
  });
});
