import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK initialization.
 *
 * Server-side only. Uses a service account loaded from env vars. The
 * private key in env is expected to contain escaped `\n` sequences — we
 * convert them back to real newlines before handing them to the cert().
 *
 * The init is deferred via a Proxy on `adminDb`/`adminAuth` so that
 * `next build` can import this module in environments where the service
 * account env vars are not yet configured (placeholder / CI / preview).
 * The first actual method call (e.g. `adminDb.collection(...)`) will
 * trigger initialization. Missing env vars are surfaced as a runtime
 * error on that first call instead of crashing the whole build.
 */

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY env vars.',
    );
  }

  const privateKey = rawKey.replace(/\\n/g, '\n').trim();

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let _db: Firestore | undefined;
let _auth: Auth | undefined;

function db(): Firestore {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
}

function authInstance(): Auth {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
}

/**
 * Lazy proxies — real init happens on first property access, so importing
 * this module during `next build` is always safe.
 */
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop, receiver) {
    return Reflect.get(db() as unknown as object, prop, receiver);
  },
});

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_t, prop, receiver) {
    return Reflect.get(authInstance() as unknown as object, prop, receiver);
  },
});
