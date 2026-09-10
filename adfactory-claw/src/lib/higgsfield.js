// Higgsfield image editing, in JS.
//
// The Python client (scripts/higgsfield.py) cannot run here: the image is
// node:20-slim and has no Python. This is a faithful port of the three calls the
// static pipeline needs — import a source image, submit an edit, poll the job.
//
// ⛔ AUTH: refresh, never re-auth. The access token lives 3600s; the refresh
// token lives ~7 days AND ROTATES on every refresh, so the rotated value must be
// persisted or the next run is locked out. On Cloud Run /tmp is wiped between
// container starts and an env var cannot be rewritten by the container, so the
// token lives in Secret Manager (`higgsfield-token`) and each refresh adds a new
// version. The service account holds secretAccessor + secretVersionAdder for
// exactly that reason.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const AUTH = "https://fnf-device-auth.higgsfield.ai";
const API = "https://mcp.higgsfield.ai/mcp";
const SECRET = process.env.HF_SECRET_NAME || "higgsfield-token";
const PROJECT = process.env.HF_SECRET_PROJECT || process.env.VEO_PROJECT || "varribrain";

/*
 * Local fallback. Secret Manager is the store on Cloud Run, but ADC on a laptop
 * goes stale (`invalid_rapt`) and the claw is also expected to be runnable on
 * this Mac. When HF_TOKEN_FILE exists we read AND rotate through it instead, so
 * the same client works in both places with no branching at the call sites.
 */
const LOCAL = process.env.HF_TOKEN_FILE ||
  path.join(os.homedir(), ".config", "higgsfield", "token.json");
const useLocal = () => {
  try { return fs.existsSync(LOCAL); } catch { return false; }
};

let auth;
async function gcpToken() {
  auth ||= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const c = await auth.getClient();
  return (await c.getAccessToken())?.token;
}

const secretBase = () =>
  `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${SECRET}`;

async function readToken() {
  if (useLocal()) return JSON.parse(fs.readFileSync(LOCAL, "utf8"));
  const t = await gcpToken();
  const res = await fetch(`${secretBase()}/versions/latest:access`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) throw new Error(`secret read ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { payload } = await res.json();
  return JSON.parse(Buffer.from(payload.data, "base64").toString("utf8"));
}

async function writeToken(tok) {
  if (useLocal()) {
    // Same contract as the secret path: persist the ROTATED refresh token.
    fs.writeFileSync(LOCAL, JSON.stringify(tok));
    return;
  }
  const t = await gcpToken();
  const res = await fetch(`${secretBase()}:addVersion`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: { data: Buffer.from(JSON.stringify(tok), "utf8").toString("base64") },
    }),
  });
  // Never fatal: the edit already succeeded with the token we hold. Losing the
  // rotation costs the NEXT run, and that is worth an alarm, not this run's work.
  if (!res.ok) console.error("[hf] token rotation NOT persisted:", res.status, (await res.text()).slice(0, 200));
}

/** Rotate the stored token and return a fresh access token. */
export async function refreshToken(tries = 4) {
  const tok = await readToken();
  let last;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${AUTH}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tok.refresh_token }),
    });
    const txt = await res.text();
    try {
      const next = JSON.parse(txt);
      if (next.access_token) {
        await writeToken(next); // persist the ROTATED refresh_token
        return next.access_token;
      }
      last = txt;
    } catch {
      last = txt;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`hf refresh failed: ${String(last).slice(0, 200)}`);
}

async function call(tool, args, token) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      /*
       * ⛔ generate_* tools NEST their arguments under `params`; every other tool
       * is flat. A predicate, not a list — copied from scripts/higgsfield.py,
       * which is the client that actually works against this API.
       */
      params: { name: tool, arguments: tool.startsWith("generate_") ? { params: args } : args },
    }),
  });
  return res.text();
}

const firstUrl = (txt, exclude = []) => {
  const urls = String(txt).match(/https?:\/\/[^\s"'\\]+\.(?:png|jpe?g|webp)/gi) || [];
  return urls.find((u) => !exclude.includes(u)) || null;
};

async function importImage(url, token) {
  const txt = await call("media_import_url", { url, type: "image" }, token);
  const m = String(txt).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) throw new Error(`hf import: no media id in ${String(txt).slice(0, 200)}`);
  return m[0];
}

async function submitEdit(mediaId, prompt, token, { aspectRatio = "4:5", resolution = "4k", model = "nano_banana_pro" } = {}) {
  const txt = await call(
    "generate_image",
    {
      model,
      prompt,
      // ⛔ Not inherited from the source. Omit it and Higgsfield returns a 3:4 1k
      // crop; 2k drifts the glyphs and this creative is all text.
      aspect_ratio: aspectRatio,
      resolution,
      use_unlim: false,
      medias: [{ value: mediaId, role: "image_references" }],
    },
    token,
  );
  const m = String(txt).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) throw new Error(`hf submit: no job id in ${String(txt).slice(0, 200)}`);
  return m[0];
}

async function poll(jobId, token, { exclude = [], tries = 90, every = 8000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const txt = await call("job_status", { jobId }, token);
    const url = firstUrl(txt, exclude);
    if (url) return url;
    if (/failed|canceled|cancelled/i.test(String(txt))) {
      throw new Error(`hf job ${jobId} failed: ${String(txt).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, every));
  }
  throw new Error(`hf job ${jobId} timed out`);
}

/**
 * Edit an existing creative and return the URL of the result.
 *
 * Source-image driven on purpose: Higgsfield here VARIES a proven winner, it does
 * not invent a poster from nothing. `srcUrl` must be publicly fetchable.
 */
export async function editCreative(srcUrl, prompt, opts = {}) {
  const token = opts.token || (await refreshToken());
  const mediaId = await importImage(srcUrl, token);
  const jobId = await submitEdit(mediaId, prompt, token, opts);
  return poll(jobId, token, { exclude: [srcUrl], ...opts });
}
