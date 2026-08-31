/**
 * Integration tests for POST/GET /api/inboxes — the inbox connect endpoint.
 *
 * Exercises the real route handlers with Clerk auth + Firestore mocked at the
 * module boundary (in-memory double), asserting the persisted record and the
 * HTTP envelope the client relies on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFirestoreMock, type Store } from '@/tests/firestore-mock';

const mocks = vi.hoisted(() => ({
  adminDb: {} as { collection: (name: string) => unknown },
  auth: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ adminDb: mocks.adminDb }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mailforge/client', () => ({
  isConfigured: () => false,
  purchaseMailboxes: vi.fn(),
}));
vi.mock('@/lib/smtp/mailer', () => ({ encryptPassword: (p: string) => `enc:${p}` }));

import { POST, GET } from './route';

let store: Store;

function setup(seed: Store = {}) {
  const mock = createFirestoreMock(seed);
  store = mock.store;
  mocks.adminDb.collection = mock.db.collection;
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/inboxes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
  mocks.auth.mockResolvedValue({ userId: 'user_1' });
  setup();
});

describe('POST /api/inboxes (gmail OAuth)', () => {
  it('creates a connecting record WITHOUT a client-supplied email and returns an authUrl', async () => {
    const res = await POST(postReq({ provider: 'gmail' }));
    expect(res.status).toBe(201);

    const body = await res.json();
    const record = body.data;

    // The Google consent URL must be returned so the client can redirect.
    expect(record.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    // state carries the inbox id so the callback can find this record.
    expect(record.authUrl).toContain(`state=${record.id}`);
    expect(record.authUrl).toContain('redirect_uri=');

    // Persisted to the inboxes collection in a connecting state.
    const persisted = store.inboxes[record.id];
    expect(persisted).toMatchObject({
      userId: 'user_1',
      provider: 'gmail',
      status: 'connecting',
    });
    expect(persisted.email).toBe('');
  });

  it('rejects a smtp_imap connection with no email (400, no record written)', async () => {
    const res = await POST(postReq({ provider: 'smtp_imap' }));
    expect(res.status).toBe(400);
    expect(Object.keys(store.inboxes ?? {})).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const res = await POST(postReq({ provider: 'gmail' }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inboxes', () => {
  it('returns the persisted inboxes for the user (not the demo seed)', async () => {
    setup({
      inboxes: {
        ib_real: { id: 'ib_real', userId: 'user_1', provider: 'gmail', email: 'me@varritech.com', status: 'connected' },
        ib_other: { id: 'ib_other', userId: 'someone_else', provider: 'gmail', email: 'x@y.com', status: 'connected' },
      },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: 'ib_real', email: 'me@varritech.com' });
  });
});
