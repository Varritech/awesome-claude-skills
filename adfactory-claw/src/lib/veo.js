// Veo3 video generation on Vertex AI.
// Cloud Run can't run `gcloud auth print-access-token` as the user, so we mint an
// access token from an OFFLINE OAuth refresh token (installed-app flow, generated
// once locally via scripts/mint-veo-token.mjs). Falls back to null on any failure
// so the pipeline can use a code-built stand-in background instead of hard-failing.
import { config } from "../config.js";
import fs from "node:fs";
import path from "node:path";

let cachedToken = null;
let cachedExp = 0;

export async function veoAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExp - 60_000) return cachedToken;
  const { clientId, clientSecret, refreshToken } = config.veo;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[veo] token mint failed", res.status, await res.text());
    return null;
  }
  const j = await res.json();
  cachedToken = j.access_token;
  cachedExp = now + (j.expires_in || 3000) * 1000;
  return cachedToken;
}

// Generate one 8s 9:16 clip from a prompt. Returns local mp4 path, or null on failure.
export async function veoGenerate({ prompt, outPath, aspect = "9:16" }) {
  if (!config.veo.enabled) return null;
  const token = await veoAccessToken();
  if (!token) {
    console.warn("[veo] no token; skipping (stand-in will be used)");
    return null;
  }
  const { project, location, model } = config.veo;
  const base = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}`;

  // start long-running predict
  const start = await fetch(`${base}:predictLongRunning`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: aspect, sampleCount: 1, durationSeconds: 8, generateAudio: false },
    }),
  });
  if (!start.ok) {
    console.error("[veo] start failed", start.status, await start.text());
    return null;
  }
  const op = await start.json();
  const opName = op.name;

  // poll
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const poll = await fetch(`${base}:fetchPredictOperation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operationName: opName }),
    });
    if (!poll.ok) continue;
    const pj = await poll.json();
    if (!pj.done) continue;
    const b64 =
      pj.response?.videos?.[0]?.bytesBase64Encoded ||
      pj.response?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) {
      console.error("[veo] op done but no bytes", JSON.stringify(pj).slice(0, 400));
      return null;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
    return outPath;
  }
  console.error("[veo] timed out");
  return null;
}
