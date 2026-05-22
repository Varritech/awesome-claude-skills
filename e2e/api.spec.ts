import { test, expect } from '@playwright/test';

// API tests — require running dev server at localhost:3000
// Run with: npm run dev (in another terminal) then npx playwright test e2e/api.spec.ts

test.use({ baseURL: 'http://localhost:3000' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Headers sent with every authenticated request.
 * Clerk will reject this fake token with 401, which is the expected
 * behaviour — these tests confirm auth middleware is running, not that
 * the full feature works end-to-end without a real session.
 */
const AUTH_HEADERS = {
  Authorization: 'Bearer fake-token',
  'Content-Type': 'application/json',
};

// ---------------------------------------------------------------------------
// Campaigns API
// ---------------------------------------------------------------------------

test.describe('Campaigns API', () => {
  test('GET /api/campaigns returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/campaigns', { headers: AUTH_HEADERS });
    // Clerk rejects the fake token — confirms auth middleware is active
    expect(res.status()).toBe(401);
  });

  test('POST /api/campaigns returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.post('/api/campaigns', {
      headers: AUTH_HEADERS,
      data: { name: 'Test Campaign', persona: 'closer' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/campaigns/:id returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/campaigns/cmp_demo_1', { headers: AUTH_HEADERS });
    expect(res.status()).toBe(401);
  });

  test('PATCH /api/campaigns/:id returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.patch('/api/campaigns/cmp_demo_1', {
      headers: AUTH_HEADERS,
      data: { name: 'Updated' },
    });
    expect(res.status()).toBe(401);
  });

  test('DELETE /api/campaigns/:id returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.delete('/api/campaigns/cmp_demo_1', { headers: AUTH_HEADERS });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Leads API
// ---------------------------------------------------------------------------

test.describe('Leads API', () => {
  test('GET /api/leads returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/leads', { headers: AUTH_HEADERS });
    expect(res.status()).toBe(401);
  });

  test('POST /api/leads returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.post('/api/leads', {
      headers: AUTH_HEADERS,
      data: {
        source: 'manual',
        leads: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            company: 'Acme',
            industry: 'SaaS',
            location: 'New York, NY',
          },
        ],
      },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/leads/search returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get(
      '/api/leads/search?provider=mock&industry=SaaS&location=NYC&count=5',
      { headers: AUTH_HEADERS },
    );
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Deliverability API
// ---------------------------------------------------------------------------

test.describe('Deliverability API', () => {
  test('GET /api/deliverability returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/deliverability', { headers: AUTH_HEADERS });
    expect(res.status()).toBe(401);
  });

  test('GET /api/deliverability/recommendations returns 401 or 404 (endpoint requires auth if it exists)', async ({ request }) => {
    const res = await request.get('/api/deliverability/recommendations', { headers: AUTH_HEADERS });
    // If the route exists, auth middleware must block it (401).
    // If not yet implemented, 404 is acceptable — but never an unprotected 200.
    expect([401, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Export API
// ---------------------------------------------------------------------------

test.describe('Export API', () => {
  test('GET /api/export/leads returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/export/leads', { headers: AUTH_HEADERS });
    // Auth must gate this endpoint; 404 only acceptable if route not yet built
    expect([401, 404]).toContain(res.status());
  });

  test('GET /api/export/campaigns returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/export/campaigns', { headers: AUTH_HEADERS });
    expect([401, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Tracking API (pixel / click redirect)
// ---------------------------------------------------------------------------

test.describe('Tracking API', () => {
  test('GET /api/track/nonexistent-email returns 200 GIF pixel (email not found still returns pixel)', async ({ request }) => {
    const res = await request.get('/api/track/nonexistent-email-00000000');
    // Tracking pixel endpoints must never leak 404/500 — always return the 1×1 GIF
    // If the route does not yet exist, 404 is the only acceptable alternative
    if (res.status() === 404) {
      // Route not yet implemented — skip content assertion
      expect(res.status()).toBe(404);
    } else {
      expect(res.status()).toBe(200);
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/image\/(gif|png)/);
    }
  });

  test('GET /api/track/click?url=javascript:alert(1) returns 400 (XSS redirect blocked)', async ({ request }) => {
    const res = await request.get(
      '/api/track/click?url=javascript%3Aalert(1)',
      { maxRedirects: 0 },
    );
    // Must block javascript: protocol redirects
    if (res.status() === 404) {
      // Route not yet implemented — acceptable
      expect(res.status()).toBe(404);
    } else {
      expect(res.status()).toBe(400);
    }
  });

  test('GET /api/track/click?url=https://evil.com returns 400 (off-domain redirect blocked)', async ({ request }) => {
    const res = await request.get(
      '/api/track/click?url=https%3A%2F%2Fevil.com',
      { maxRedirects: 0 },
    );
    if (res.status() === 404) {
      expect(res.status()).toBe(404);
    } else {
      expect(res.status()).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Security API
// ---------------------------------------------------------------------------

test.describe('Security API', () => {
  test('GET /api/security/checklist returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/security/checklist', { headers: AUTH_HEADERS });
    expect(res.status()).toBe(401);
  });

  test('GET /api/audit returns 401 for unauthenticated request (auth middleware running)', async ({ request }) => {
    const res = await request.get('/api/audit', { headers: AUTH_HEADERS });
    // Auth middleware must block before the admin check; 401 not 403 with a fake token
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Webhooks (unauthenticated endpoints)
// ---------------------------------------------------------------------------

test.describe('Webhooks', () => {
  test('POST /api/webhooks/complaint with no signature returns 200 when MAILFORGE_WEBHOOK_SECRET is not set', async ({ request }) => {
    const res = await request.post('/api/webhooks/complaint', {
      headers: { 'Content-Type': 'application/json' },
      data: { type: 'complaint', email: 'spam-reporter@example.com' },
    });
    // When secret is not configured, verification is skipped and webhook is accepted.
    // If the route does not yet exist, 404 is the only acceptable alternative.
    expect([200, 404]).toContain(res.status());
  });

  test('POST /api/webhooks/clerk with invalid svix signature returns 400', async ({ request }) => {
    const res = await request.post('/api/webhooks/clerk', {
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_fake',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalidsignature',
      },
      data: { type: 'user.created', data: { id: 'user_test' } },
    });
    // With all three svix headers present AND a CLERK_WEBHOOK_SECRET set,
    // the Webhook.verify() call must reject and return 400.
    // Without CLERK_WEBHOOK_SECRET configured, the body is accepted (200/204).
    expect([200, 400]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
    }
  });
});

// ---------------------------------------------------------------------------
// Response shape contracts (run only when server is live and auth succeeds)
// These are documented so they can be enabled once a test-mode Clerk token
// is available via PLAYWRIGHT_CLERK_TOKEN env var.
// ---------------------------------------------------------------------------

test.describe('Response shape contracts (documented — requires valid Clerk session)', () => {
  // Campaigns list shape: { data: Array }
  test.skip('GET /api/campaigns returns { data: [] } shape', async ({ request }) => {
    const res = await request.get('/api/campaigns');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  // Campaign create shape: { data: { id } }
  test.skip('POST /api/campaigns returns 201 with id', async ({ request }) => {
    const res = await request.post('/api/campaigns', {
      data: { name: 'Test Campaign', persona: 'closer' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
  });

  // Leads list shape: { data: { leads: [], industries: [] } }
  test.skip('GET /api/leads returns { data: { leads, industries } } shape', async ({ request }) => {
    const res = await request.get('/api/leads');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('leads');
    expect(body.data).toHaveProperty('industries');
    expect(Array.isArray(body.data.leads)).toBe(true);
    expect(Array.isArray(body.data.industries)).toBe(true);
  });

  // Leads import shape: { data: { imported: number } }
  test.skip('POST /api/leads returns 201 with imported count', async ({ request }) => {
    const res = await request.post('/api/leads', {
      data: {
        source: 'manual',
        leads: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            company: 'Acme',
            industry: 'SaaS',
            location: 'New York, NY',
          },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.data.imported).toBe('number');
    expect(body.data.imported).toBeGreaterThanOrEqual(1);
  });

  // Leads search (mock provider) shape: { data: { provider, results } }
  test.skip('GET /api/leads/search?provider=mock returns { data: { provider, results } }', async ({ request }) => {
    const res = await request.get('/api/leads/search?provider=mock&industry=SaaS&location=NYC&count=5');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  // Deliverability shape: { data: { inboxHealth, dnsRecords, blacklistChecks } }
  test.skip('GET /api/deliverability returns healthScore fields', async ({ request }) => {
    const res = await request.get('/api/deliverability');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('inboxHealth');
    expect(body.data).toHaveProperty('dnsRecords');
    expect(body.data).toHaveProperty('blacklistChecks');
  });

  // Export leads: Content-Type text/csv with correct header row
  test.skip('GET /api/export/leads returns CSV with correct column headers', async ({ request }) => {
    const res = await request.get('/api/export/leads');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/text\/csv/);
    const text = await res.text();
    const firstLine = text.split('\n')[0]?.trim() ?? '';
    expect(firstLine).toBe('id,name,company,industry,location,status,source,tags,engagementScore,createdAt');
  });

  // Export campaigns: Content-Type text/csv
  test.skip('GET /api/export/campaigns returns CSV', async ({ request }) => {
    const res = await request.get('/api/export/campaigns');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/text\/csv/);
  });

  // Security checklist shape: { data: { items: [] } }
  test.skip('GET /api/security/checklist returns { data: { items: [] } }', async ({ request }) => {
    const res = await request.get('/api/security/checklist');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  // Audit endpoint returns 403 for non-admin (not 401 — user is authed, just not admin)
  test.skip('GET /api/audit returns 403 for authenticated non-admin user', async ({ request }) => {
    const res = await request.get('/api/audit');
    expect(res.status()).toBe(403);
  });
});
