// GCS upload via the same access token used for Veo (ADC on Cloud Run also works,
// but we reuse the offline OAuth token so one credential covers both). Public,
// long-cache, video/mp4 or image/jpeg. Returns the public URL.
import fs from "node:fs";
import { config } from "../config.js";
import { veoAccessToken } from "./veo.js";
import { GoogleAuth } from "google-auth-library";

// Prefer ADC (Cloud Run SA) for storage; fall back to the Veo OAuth token.
let auth;
async function storageToken() {
  try {
    auth ||= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/devstorage.read_write"] });
    const c = await auth.getClient();
    const t = await c.getAccessToken();
    if (t?.token) return t.token;
  } catch (e) {
    /* fall through */
  }
  return veoAccessToken();
}

export async function uploadPublic(localPath, objectName, contentType) {
  const token = await storageToken();
  if (!token) throw new Error("no GCS token (set ADC or Veo OAuth)");
  const bucket = config.gcs.bucket;
  const name = encodeURIComponent(objectName);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${name}`;
  const body = fs.readFileSync(localPath);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "Cache-Control": "public,max-age=31536000",
    },
    body,
  });
  if (!res.ok) throw new Error(`GCS upload failed ${res.status}: ${await res.text()}`);
  return `${config.gcs.publicBase}/${bucket}/${objectName}`;
}

export const publicUrl = (objectName) =>
  `${config.gcs.publicBase}/${config.gcs.bucket}/${objectName}`;
