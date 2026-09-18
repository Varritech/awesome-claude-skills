// Claude wrapper — plain text + forced-JSON (tool) helpers.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// Identity-linked keys 400 on every call unless the workspace header rides along;
// workspace-scoped keys must NOT send it, hence the conditional spread.
const WS = process.env.ANTHROPIC_WORKSPACE_ID;
const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  ...(WS ? { defaultHeaders: { "anthropic-workspace-id": WS } } : {}),
});

export async function ask(prompt, { system, maxTokens = 2000 } = {}) {
  const r = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

// Force structured JSON via a single tool the model must call.
export async function askJSON(prompt, schema, { system, maxTokens = 2000 } = {}) {
  const r = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    system,
    tools: [{ name: "emit", description: "Return the structured result.", input_schema: schema }],
    tool_choice: { type: "tool", name: "emit" },
    messages: [{ role: "user", content: prompt }],
  });
  const tu = r.content.find((b) => b.type === "tool_use");
  if (!tu) throw new Error("model did not call emit tool");
  return tu.input;
}
