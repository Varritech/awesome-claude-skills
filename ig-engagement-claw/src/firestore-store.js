// Firestore backend shaped like the {get,set} seam handoff.js expects.
// firebase-admin is CJS: under ESM dynamic import the real API hangs off
// `.default` — reading it off the namespace crashed a Cloud Run rev at boot.
// See [[reference_cjs_dynamic_import_esm_default_interop]].
export async function firestoreStore() {
  const mod = await import('firebase-admin');
  const admin = mod.default ?? mod;
  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();
  return {
    async get(collection, key) {
      const snap = await db.collection(collection).doc(key).get();
      return snap.exists ? snap.data() : null;
    },
    async set(collection, key, value) {
      await db.collection(collection).doc(key).set(value);
    },
  };
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
