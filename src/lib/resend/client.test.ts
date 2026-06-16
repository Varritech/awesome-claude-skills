/**
 * Tests for the Resend client wrapper.
 *
 * We mock global.fetch so the tests exercise URL/header/body construction
 * without hitting the live API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = process.env.RESEND_API_KEY;

interface MockFetchCall {
  url: string;
  init: RequestInit;
}

function mockFetch(response: { status?: number; body?: unknown }): {
  calls: MockFetchCall[];
  restore: () => void;
} {
  const calls: MockFetchCall[] = [];
  const status = response.status ?? 200;
  const body = response.body ?? {};
  global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => (global.fetch = ORIGINAL_FETCH) };
}

describe('resend.isConfigured', () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_ENV;
  });

  it('returns false when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    const { isConfigured } = await import('./client');
    expect(isConfigured()).toBe(false);
  });

  it('returns true when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    vi.resetModules();
    const { isConfigured } = await import('./client');
    expect(isConfigured()).toBe(true);
  });
});

describe('resend.createDomain', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_abc';
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_ENV;
  });

  it('posts to /domains with the bearer token and JSON body', async () => {
    const { calls, restore } = mockFetch({
      body: {
        id: 'd_123',
        name: 'example.com',
        status: 'not_started',
        region: 'us-east-1',
        created_at: '2026-06-16T00:00:00Z',
        records: [],
      },
    });

    const { createDomain } = await import('./client');
    const result = await createDomain('example.com');

    expect(result.id).toBe('d_123');
    expect(result.name).toBe('example.com');
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/domains');
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_test_abc',
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      name: 'example.com',
      region: 'us-east-1',
    });

    restore();
  });

  it('honors the optional region argument', async () => {
    const { calls, restore } = mockFetch({
      body: {
        id: 'd_eu',
        name: 'example.eu',
        status: 'not_started',
        region: 'eu-west-1',
        created_at: '2026-06-16T00:00:00Z',
      },
    });

    const { createDomain } = await import('./client');
    await createDomain('example.eu', 'eu-west-1');

    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      name: 'example.eu',
      region: 'eu-west-1',
    });
    restore();
  });

  it('throws when Resend returns a non-2xx response', async () => {
    const { restore } = mockFetch({
      status: 422,
      body: { message: 'Domain already exists' },
    });

    const { createDomain } = await import('./client');
    await expect(createDomain('example.com')).rejects.toThrow(/422.*Domain already exists/);
    restore();
  });

  it('throws ResendNotConfiguredError if the API key is missing', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const mod = await import('./client');
    await expect(mod.createDomain('example.com')).rejects.toThrow(/RESEND_API_KEY is not set/);
  });
});

describe('resend.verifyDomain', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_abc';
    vi.resetModules();
  });

  it('hits the /domains/{id}/verify endpoint with POST', async () => {
    const { calls, restore } = mockFetch({
      body: { id: 'd_999', name: 'verified.com', status: 'verified', region: 'us-east-1', created_at: '' },
    });

    const { verifyDomain } = await import('./client');
    const result = await verifyDomain('d_999');

    expect(calls[0]!.url).toBe('https://api.resend.com/domains/d_999/verify');
    expect(calls[0]!.init.method).toBe('POST');
    expect(result.status).toBe('verified');
    restore();
  });
});

describe('resend.sendEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_abc';
    vi.resetModules();
  });

  it('posts to /emails and returns the message id', async () => {
    const { calls, restore } = mockFetch({ body: { id: 'msg_abc' } });

    const { sendEmail } = await import('./client');
    const result = await sendEmail({
      from: 'hello@varritech.com',
      to: 'lead@example.com',
      subject: 'Hi',
      text: 'plain',
    });

    expect(result.id).toBe('msg_abc');
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
      from: 'hello@varritech.com',
      to: 'lead@example.com',
      subject: 'Hi',
      text: 'plain',
    });
    restore();
  });
});
