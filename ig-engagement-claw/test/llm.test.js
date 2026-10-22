import { describe, it, expect } from 'vitest';
import { anthropicLlm, claudeCliLlm } from '../src/llm.js';

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

describe('claudeCliLlm', () => {
  // Every API key on the Mac died (401 / no credit) on 2026-09-18 and the claw
  // drafted nothing for three weeks. The CLI backend uses the Mac's Claude
  // Code login instead, so a dead key no longer stops the claw.
  const fakeRun = (stdout, calls = []) => async (args, input, env) => {
    calls.push({ args, input, env });
    return { stdout };
  };

  it('pipes the prompt on stdin and returns the result text', async () => {
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'drafted', is_error: false }), calls) });
    expect(await llm({ prompt: 'hi' })).toBe('drafted');
    expect(calls[0].input).toBe('hi');
    expect(calls[0].args).toEqual(expect.arrayContaining(['-p', '--model', 'm']));
  });

  it('strips the dead API key from the child env so the login is used', async () => {
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'x' }), calls) });
    process.env.ANTHROPIC_API_KEY = 'dead';
    await llm({ prompt: 'hi' });
    expect('ANTHROPIC_API_KEY' in calls[0].env).toBe(false);
  });

  it('runs with no tools so a drafting prompt cannot burn its one turn on a tool call', async () => {
    // Live 2026-10-10: the opener prompt made the CLI reach for a tool and
    // every draft died with error_max_turns.
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'x' }), calls) });
    await llm({ prompt: 'hi' });
    const i = calls[0].args.indexOf('--tools');
    expect(i).toBeGreaterThan(-1);
    expect(calls[0].args[i + 1]).toBe('');
  });

  it('ignores user/project settings so CLAUDE.md and hooks cannot hijack the draft', async () => {
    // The repo's CLAUDE.md + hooks still produced error_max_turns with no tools.
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'x' }), calls) });
    await llm({ prompt: 'hi' });
    const i = calls[0].args.indexOf('--setting-sources');
    expect(i).toBeGreaterThan(-1);
    expect(calls[0].args[i + 1]).toBe('');
  });

  it('runs on the shared claws subscription token, not the personal login', async () => {
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', oauthToken: 'tok', run: fakeRun(JSON.stringify({ result: 'x' }), calls) });
    await llm({ prompt: 'hi' });
    expect(calls[0].env.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok');
  });

  it('replaces the Claude Code agent prompt with a plain drafting one', async () => {
    // Live 2026-10-10: under the default agent prompt one opener came back as
    // "This isn't something I can help draft".
    const calls = [];
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'x' }), calls) });
    await llm({ prompt: 'hi' });
    const i = calls[0].args.indexOf('--system-prompt');
    expect(i).toBeGreaterThan(-1);
    expect(calls[0].args[i + 1]).toMatch(/Output only/);
  });

  it('throws when the CLI reports an error', async () => {
    const llm = claudeCliLlm({ model: 'm', run: fakeRun(JSON.stringify({ result: 'nope', is_error: true })) });
    await expect(llm({ prompt: 'hi' })).rejects.toThrow(/claude-cli/);
  });
});
