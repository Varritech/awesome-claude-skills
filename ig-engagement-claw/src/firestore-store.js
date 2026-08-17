// Firestore backend shaped like the {get,set} seam handoff.js expects.
//
// ⛔ firebase-admin v14 REMOVED the old namespace API this used to reach for.
// `admin.apps` and `admin.firestore()` are both gone — off the namespace AND off
// `.default` — so the previous `admin.apps.length` line threw
// "Cannot read properties of undefined (reading 'length')" on the first real
// call. v14 exposes the modular API as named ESM exports instead, which also
// means the old CJS `.default` unwrap is no longer needed here.
// Related history: [[reference_cjs_dynamic_import_esm_default_interop]].
export async function firestoreStore() {
  const { getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
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
