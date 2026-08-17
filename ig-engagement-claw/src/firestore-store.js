// Firestore backend shaped like the {get,set} seam handoff.js expects.
//
// ⛔ Talks the REST API with a `gcloud auth print-access-token` bearer, NOT
// firebase-admin. The admin SDK needs Application Default Credentials, and this
// Workspace enforces a reauth policy that expires ADC into `invalid_rapt` —
// which is exactly what happened on the first two live sends (2026-08-17), while
// the ordinary user token was valid the whole time. An unattended claw cannot
// depend on a credential that needs someone to click through a browser every few
// days. This also drops a 60-package dependency the claw used for two writes.
import { execFile } from 'node:child_process';

/** Firestore REST document URL. Exported so the test pins the exact path. */
export const DOC_URL = (project, collection, key) =>
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}/${encodeURIComponent(key)}`;

const gcloudToken = () =>
  new Promise((resolve, reject) => {
    execFile('gcloud', ['auth', 'print-access-token'], (err, stdout) =>
      err ? reject(new Error(`gcloud auth print-access-token failed: ${err.message}`)) : resolve(stdout.trim()));
  });

/** Plain JS -> Firestore's tagged-value wire format. */
function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value) } };
}
const encodeFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}
const decodeFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

export function restFirestoreStore({ project, token = gcloudToken, fetchImpl = fetch }) {
  const auth = async () => ({ Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' });
  return {
    async get(collection, key) {
      const res = await fetchImpl(DOC_URL(project, collection, key), { method: 'GET', headers: await auth() });
      // A missing doc is the normal first-contact case, not an error.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`firestore get ${collection}/${key}: ${res.status} ${await res.text()}`);
      const body = await res.json();
      return decodeFields(body.fields ?? {});
    },
    async set(collection, key, value) {
      const res = await fetchImpl(DOC_URL(project, collection, key), {
        method: 'PATCH', headers: await auth(), body: JSON.stringify({ fields: encodeFields(value) }),
      });
      if (!res.ok) throw new Error(`firestore set ${collection}/${key}: ${res.status} ${await res.text()}`);
    },
  };
}

export async function firestoreStore() {
  return restFirestoreStore({ project: process.env.GOOGLE_CLOUD_PROJECT });
}

// Used when Firestore isn't configured — the claw still sends, it just can't
// hand off. Loud on purpose: a silent no-op here means the sales claw
// re-introduces the founder to people we already opened.
export function nullStore(log = console.error) {
  return {
    async get() { return null; },
    async set(collection, key) {
      log(`[claw] ⚠ NO FIRESTORE — handoff for ${collection}/${key} was NOT written`);
    },
  };
}
