/**
 * In-memory Firestore double for route-handler tests.
 *
 * This is a genuine stand-in for the Firestore Admin SDK (stores and retrieves
 * real values), NOT a re-implementation of any code under test. It supports the
 * narrow slice of the API our routes use: collection().doc().get/set/update and
 * collection().where().get().
 *
 *   const { db, store } = createFirestoreMock({ inboxes: { ib_1: {...} } });
 *   vi.mock('@/lib/firebase/admin', () => ({ adminDb: db }));
 *
 * `store` is the live backing object — assert against it after the handler runs.
 */

export type Store = Record<string, Record<string, Record<string, unknown>>>;

export function createFirestoreMock(seed: Store = {}) {
  const store: Store = {};
  for (const [col, docs] of Object.entries(seed)) {
    store[col] = {};
    for (const [id, data] of Object.entries(docs)) {
      store[col][id] = { ...data };
    }
  }

  function ensure(col: string) {
    store[col] ??= {};
    return store[col];
  }

  function docRef(col: string, id: string) {
    return {
      async get() {
        const data = ensure(col)[id];
        return {
          exists: data !== undefined,
          id,
          data: () => data,
        };
      },
      async set(value: Record<string, unknown>, opts?: { merge?: boolean }) {
        ensure(col)[id] = opts?.merge ? { ...(ensure(col)[id] ?? {}), ...value } : { ...value };
      },
      async update(value: Record<string, unknown>) {
        const existing = ensure(col)[id];
        if (existing === undefined) {
          throw new Error(`No document to update: ${col}/${id}`);
        }
        ensure(col)[id] = { ...existing, ...value };
      },
    };
  }

  function collection(col: string) {
    const filters: Array<[string, unknown]> = [];
    const query = {
      doc: (id: string) => docRef(col, id),
      where(field: string, _op: string, value: unknown) {
        filters.push([field, value]);
        return query;
      },
      async get() {
        let docs = Object.entries(ensure(col)).map(([id, data]) => ({
          id,
          data: () => data,
        }));
        for (const [field, value] of filters) {
          docs = docs.filter((d) => (d.data() as Record<string, unknown>)[field] === value);
        }
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
    return query;
  }

  return { store, db: { collection } };
}
