/**
 * Integration tests for GET /api/inboxes/callback/google — the OAuth callback
 * that completes a Gmail inbox connection after Google consent.
 *
 * Google's token/userinfo calls are mocked at the @/lib/google/oauth boundary;
 * Firestore + Clerk are mocked as usual. Assertions cover the persisted record
 * transition (connecting → connected, email resolved, tokens stored) and the
 * redirect the browser follows.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFirestoreMock, type Store } from '@/tests/firestore-mock';

const mocks = vi.hoisted(() => ({
  adminDb: {} as { collection: (name: string) => unknown },
  auth: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getGoogleEmail: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ adminDb: mocks.adminDb }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/google/oauth', () => ({
  exchangeCodeForTokens: mocks.exchangeCodeForTokens,
  getGoogleEmail: mocks.getGoogleEmail,
  isGoogleOAuthConfigured: () => true,
}));
vi.mock('@/lib/crypto/tokens', () => ({ encryptToken: (t: string) => `enc:${t}` }));

import { GET } from './route';

let store: Store;

function connectingSeed(): Store {
  return {
    inboxes: {
      ib_1: {
        id: 'ib_1',
        userId: 'user_1',
        provider: 'gmail',
        email: '',
        status: 'connecting',
        warmupStartDate: null,
      },
    },
  };
}

function setup(seed: Store) {
  const mock = createFirestoreMock(seed);
  store = mock.store;
  mocks.adminDb.collection = mock.db.collection;
}

function cbReq(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`https://app.test/api/inboxes/callback/google?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
  mocks.auth.mockResolvedValue({ userId: 'user_1' });
  mocks.exchangeCodeForTokens.mockResolvedValue({
    accessToken: 'ya29.access',
    refreshToken: '1//refresh',
    expiresInSec: 3600,
  });
  mocks.getGoogleEmail.mockResolvedValue('cristiano@varritech.com');
  setup(connectingSeed());
});

describe('GET /api/inboxes/callback/google', () => {
  it('completes the connection: resolves email, stores tokens, marks connected, redirects to onboarding', async () => {
    const res = await GET(cbReq({ code: 'auth-code', state: 'ib_1' }));

    // Browser redirect back into the app.
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://app.test/onboarding/industry?inbox=connected');

    const rec = store.inboxes.ib_1;
    expect(rec.status).toBe('connected');
    expect(rec.email).toBe('cristiano@varritech.com');
    // Tokens stored encrypted, field names match the token-refresh job.
    expect(rec.refreshToken).toBe('enc:1//refresh');
    expect(rec.accessToken).toBe('enc:ya29.access');
    expect(typeof rec.tokenExpiresAt).toBe('string');
    expect(rec.warmupStartDate).toBeTruthy();
  });

  it('redirects with an error when the user denied consent (no record change)', async () => {
    const res = await GET(cbReq({ error: 'access_denied', state: 'ib_1' }));
    expect(res.headers.get('location')).toContain('/onboarding/inbox?error=');
    expect(store.inboxes.ib_1.status).toBe('connecting');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('redirects with an error when the token exchange fails (no record change)', async () => {
    mocks.exchangeCodeForTokens.mockRejectedValue(new Error('bad code'));
    const res = await GET(cbReq({ code: 'bad', state: 'ib_1' }));
    expect(res.headers.get('location')).toContain('/onboarding/inbox?error=');
    expect(store.inboxes.ib_1.status).toBe('connecting');
  });

  it('refuses to complete an inbox the signed-in user does not own', async () => {
    mocks.auth.mockResolvedValue({ userId: 'someone_else' });
    const res = await GET(cbReq({ code: 'auth-code', state: 'ib_1' }));
    expect(res.headers.get('location')).toContain('/onboarding/inbox?error=');
    expect(store.inboxes.ib_1.status).toBe('connecting');
  });
});
