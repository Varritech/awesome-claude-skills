// Pending-batch state, persisted to GCS as JSON so the approve link + dashboard
// work across Cloud Run cold starts. Keyed by batch id (the date). Holds the built
// ads + their meta ids. Also keeps an index.json (newest-first list of batch ids)
// so the dashboard can list everything without scanning the bucket.
import { config } from "../config.js";
import { uploadPublic, publicUrl } from "./gcs.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const stateObject = (id) => `${config.gcs.prefix}/state/${id}.json`;
const indexObject = `${config.gcs.prefix}/state/index.json`;

async function putJson(objectName, data) {
  const tmp = path.join(os.tmpdir(), objectName.replace(/\//g, "_"));
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  await uploadPublic(tmp, objectName, "application/json");
}

async function getJson(objectName) {
  const res = await fetch(publicUrl(objectName) + `?t=${Date.now()}`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveBatch(batch) {
  await putJson(stateObject(batch.id), batch);
  // upsert into the index (newest first, deduped)
  const idx = (await getJson(indexObject)) || { ids: [] };
  idx.ids = [batch.id, ...idx.ids.filter((x) => x !== batch.id)];
  await putJson(indexObject, idx);
  return batch.id;
}

export async function loadBatch(id) {
  return getJson(stateObject(id));
}

export async function listBatchIds(limit = 30) {
  const idx = (await getJson(indexObject)) || { ids: [] };
  return idx.ids.slice(0, limit);
}
