import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  };
}

// Headless Claude Code on the shared claws subscription token
// (~/.varritech/claude-oauth-token), falling back to the Mac's own login. Used when no API key works:
// the 2026-09-18 rotation left every key on this machine dead and the claw
// drafted nothing for three weeks. The key/proxy env vars are stripped, or the
// CLI would pick the dead key back up instead of the login.
const CLAUDE_BIN = `${process.env.HOME}/.local/bin/claude`;
const STRIP = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'];

async function runClaude(args, input, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { env, cwd: tmpdir() }); // outside the repo: its CLAUDE.md derails drafting
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 240_000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) reject(new Error(`claude-cli exit ${code}: ${stderr.slice(0, 300)}`));
      else resolve({ stdout });
    });
    child.stdin.end(input);
  });
}

export function claudeCliLlm({ model, oauthToken, run = runClaude }) {
  return async ({ prompt }) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !STRIP.includes(k)));
    if (oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
    const args = ['-p', '--output-format', 'json', '--max-turns', '1', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt', "You write LinkedIn DMs for Cristiano, founder of Varritech, selling done-for-you AI agents to business owners. Follow the user's instructions exactly. Output only the message they ask for.", '--model', model];
    const { stdout } = await run(args, prompt, env);
    let out;
    try { out = JSON.parse(stdout); } catch { throw new Error(`claude-cli: unparseable output: ${stdout.slice(0, 200)}`); }
    if (out.is_error || typeof out.result !== 'string') throw new Error(`claude-cli: ${out.result ?? out.subtype ?? 'no result'}`);
    return out.result;
  };
}
