/**
 * Tests for Cloud Domains client wrapper.
 *
 * We don't make live API calls — instead we mock global.fetch and
 * google-auth-library so the tests exercise URL/header/body construction.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_B64 = process.env.GCP_SERVICE_ACCOUNT_JSON_B64;
const ORIGINAL_PROJECT = process.env.GCP_PROJECT_ID;

const FAKE_CREDS = {
  type: 'service_account',
  project_id: 'test-project',
  client_email: 'sa@test-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
};

function setEnv(): void {
  process.env.GCP_SERVICE_ACCOUNT_JSON_B64 = Buffer.from(JSON.stringify(FAKE_CREDS)).toString('base64');
  process.env.GCP_PROJECT_ID = 'test-project';
}

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    async getClient() {
      return {
        getAccessToken: async () => ({ token: 'fake-access-token' }),
      };
    }
  },
}));

interface MockCall {
  url: string;
  init: RequestInit;
}

function mockFetch(response: { status?: number; body?: unknown }): {
  calls: MockCall[];
  restore: () => void;
} {
  const calls: MockCall[] = [];
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

afterEach(() => {
  if (ORIGINAL_B64 === undefined) delete process.env.GCP_SERVICE_ACCOUNT_JSON_B64;
  else process.env.GCP_SERVICE_ACCOUNT_JSON_B64 = ORIGINAL_B64;
  if (ORIGINAL_PROJECT === undefined) delete process.env.GCP_PROJECT_ID;
  else process.env.GCP_PROJECT_ID = ORIGINAL_PROJECT;
});

describe('cloudDomains.isConfigured', () => {
  it('returns false when env vars are missing', async () => {
    delete process.env.GCP_SERVICE_ACCOUNT_JSON_B64;
    delete process.env.GCP_PROJECT_ID;
    vi.resetModules();
    const mod = await import('./cloud-domains');
    expect(mod.isConfigured()).toBe(false);
  });

  it('returns true when both env vars are set', async () => {
    setEnv();
    vi.resetModules();
    const mod = await import('./cloud-domains');
    expect(mod.isConfigured()).toBe(true);
  });
});

describe('cloudDomains.searchDomains', () => {
  beforeEach(() => {
    setEnv();
    vi.resetModules();
  });

  it('builds the search URL with the encoded query', async () => {
    const { calls, restore } = mockFetch({
      body: {
        registerParameters: [
          {
            domainName: 'foo.com',
            availability: 'AVAILABLE',
            yearlyPrice: { units: '12', nanos: 0, currencyCode: 'USD' },
          },
        ],
      },
    });

    const mod = await import('./cloud-domains');
    const out = await mod.searchDomains('foo.com');

    expect(calls[0]!.url).toBe(
      'https://domains.googleapis.com/v1/projects/test-project/locations/global/registrations:searchDomains?query=foo.com',
    );
    expect(out).toEqual([
      { domainName: 'foo.com', availability: 'AVAILABLE', yearlyPriceUsdCents: 1200 },
    ]);
    restore();
  });

  it('converts price nanos to cents correctly', async () => {
    const { restore } = mockFetch({
      body: {
        registerParameters: [
          {
            domainName: 'a.io',
            availability: 'AVAILABLE',
            // 31.50 USD → units=31 nanos=500_000_000
            yearlyPrice: { units: '31', nanos: 500_000_000, currencyCode: 'USD' },
          },
        ],
      },
    });
    const mod = await import('./cloud-domains');
    const out = await mod.searchDomains('a.io');
    expect(out[0]!.yearlyPriceUsdCents).toBe(3150);
    restore();
  });

  it('omits price when currency is not USD', async () => {
    const { restore } = mockFetch({
      body: {
        registerParameters: [
          {
            domainName: 'a.eu',
            availability: 'AVAILABLE',
            yearlyPrice: { units: '10', nanos: 0, currencyCode: 'EUR' },
          },
        ],
      },
    });
    const mod = await import('./cloud-domains');
    const out = await mod.searchDomains('a.eu');
    expect(out[0]!.yearlyPriceUsdCents).toBeUndefined();
    restore();
  });

  it('returns empty array when no results come back', async () => {
    const { restore } = mockFetch({ body: {} });
    const mod = await import('./cloud-domains');
    const out = await mod.searchDomains('nothing.zzz');
    expect(out).toEqual([]);
    restore();
  });

  it('throws on non-2xx responses', async () => {
    const { restore } = mockFetch({ status: 403, body: { error: 'Forbidden' } });
    const mod = await import('./cloud-domains');
    await expect(mod.searchDomains('foo.com')).rejects.toThrow(/403/);
    restore();
  });
});

describe('cloudDomains.registerDomain', () => {
  beforeEach(() => {
    setEnv();
    vi.resetModules();
  });

  it('posts the registration body with redacted contact privacy by default', async () => {
    const { calls, restore } = mockFetch({
      body: { name: 'projects/test-project/locations/global/operations/op_123', done: false },
    });
    const mod = await import('./cloud-domains');

    await mod.registerDomain({
      domainName: 'foo.com',
      yearlyPriceUsdCents: 1200,
      contact: {
        registrantContact: {
          phoneNumber: '+16474102820',
          email: 'a@b.com',
          postalAddress: {
            regionCode: 'US',
            administrativeArea: 'NY',
            locality: 'New York',
            postalCode: '10175',
            addressLines: ['21 5th Ave'],
            recipients: ['Christian Varriale'],
          },
        },
      },
    });

    const sent = JSON.parse(calls[0]!.init.body as string);
    expect(sent.domainName).toBe('foo.com');
    expect(sent.contactSettings.privacy).toBe('REDACTED_CONTACT_DATA');
    expect(sent.contactSettings.registrantContact.phoneNumber).toBe('+16474102820');
    // admin + technical contacts should default to the registrant
    expect(sent.contactSettings.adminContact.email).toBe('a@b.com');
    expect(sent.contactSettings.technicalContact.email).toBe('a@b.com');
    // price split into units + nanos
    expect(sent.yearlyPrice.units).toBe('12');
    expect(sent.yearlyPrice.currencyCode).toBe('USD');
    restore();
  });
});
