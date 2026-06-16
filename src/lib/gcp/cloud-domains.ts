/**
 * Cloud Domains client — domain availability search + registration.
 *
 * API docs: https://cloud.google.com/domains/docs/reference/rest/v1
 *
 * Cloud Domains operates per-region (location). We use `global` because every
 * domain we care about is unaffiliated with a specific GCP region. The
 * service handles the upstream registrar (Google Registry → Squarespace
 * Domains as of 2026) and applies the registrant contact we supply
 * on a per-registration basis, so each customer ends up as the WHOIS
 * registrant of their own domain even though billing flows through our
 * GCP project.
 *
 * Cost: at-cost domain price (e.g. .com ~$12/yr, .io ~$30/yr). The
 * caller layer (the /api/domains/buy route) applies any markup before
 * charging the customer through Stripe.
 */

import { getAuth, getProjectId } from './auth';

const BASE = 'https://domains.googleapis.com/v1';
const LOCATION = 'global';

export interface CloudDomainAvailability {
  domainName: string;
  /** "AVAILABLE", "MAYBE_AVAILABLE", "UNAVAILABLE", "UNSUPPORTED", "UNKNOWN" */
  availability: string;
  /** Yearly price in cents (USD) or empty when not available for sale. */
  yearlyPriceUsdCents?: number;
}

export interface RegistrantContact {
  /** Full E.164 phone, e.g. `+16474102820`. */
  phoneNumber: string;
  /** Optional fax line. We never collect this — domains.googleapis.com tolerates omission. */
  faxNumber?: string;
  email: string;
  postalAddress: {
    regionCode: string; // ISO 3166-1 alpha-2, e.g. "US"
    administrativeArea?: string; // state/province
    locality?: string;            // city
    postalCode?: string;
    addressLines?: string[];
    recipients?: string[];
    organization?: string;
  };
}

export interface ContactSettings {
  /** Hide WHOIS data via Google's proxy registrant. Defaults to true. */
  privacy?: 'REDACTED_CONTACT_DATA' | 'PRIVATE_CONTACT_DATA' | 'PUBLIC_CONTACT_DATA';
  registrantContact: RegistrantContact;
  /** When omitted, Cloud Domains reuses the registrant contact. */
  adminContact?: RegistrantContact;
  technicalContact?: RegistrantContact;
}

export interface RegisterDomainInput {
  /** Fully qualified domain (e.g. `varritech-outreach.com`). */
  domainName: string;
  contact: ContactSettings;
  /** Cents (USD). Must match the price returned by `searchDomains`. */
  yearlyPriceUsdCents: number;
  /** Default: true. Automatically renews via the GCP billing account. */
  autoRenew?: boolean;
}

export interface CloudDomainOperation {
  name: string;
  done?: boolean;
  metadata?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('GCP access token unavailable');

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`CloudDomains ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function parentPath(): string {
  return `projects/${getProjectId()}/locations/${LOCATION}`;
}

/**
 * Search domain availability + pricing for a single query domain.
 * Returns one row per TLD result Cloud Domains returns (typically the
 * requested name plus a few suggested TLDs).
 */
export async function searchDomains(query: string): Promise<CloudDomainAvailability[]> {
  const parent = parentPath();
  const qs = `query=${encodeURIComponent(query)}`;
  interface SearchResponse {
    registerParameters?: Array<{
      domainName: string;
      availability: string;
      yearlyPrice?: { units?: string; nanos?: number; currencyCode?: string };
    }>;
  }
  const res = await authedFetch<SearchResponse>(
    `/${parent}/registrations:searchDomains?${qs}`,
  );
  return (res.registerParameters ?? []).map((r) => ({
    domainName: r.domainName,
    availability: r.availability,
    yearlyPriceUsdCents:
      r.yearlyPrice?.currencyCode === 'USD'
        ? Math.round(
            Number(r.yearlyPrice?.units ?? 0) * 100 + (Number(r.yearlyPrice?.nanos ?? 0) / 1e7),
          )
        : undefined,
  }));
}

/**
 * Register a domain. Returns the long-running operation handle; poll
 * `getOperation()` until `done === true` to find out whether the upstream
 * registrar accepted the registration.
 */
export async function registerDomain(input: RegisterDomainInput): Promise<CloudDomainOperation> {
  const parent = parentPath();
  const body = {
    domainName: input.domainName,
    contactSettings: {
      privacy: input.contact.privacy ?? 'REDACTED_CONTACT_DATA',
      registrantContact: input.contact.registrantContact,
      adminContact: input.contact.adminContact ?? input.contact.registrantContact,
      technicalContact: input.contact.technicalContact ?? input.contact.registrantContact,
    },
    yearlyPrice: {
      units: Math.floor(input.yearlyPriceUsdCents / 100).toString(),
      nanos: (input.yearlyPriceUsdCents % 100) * 1e7,
      currencyCode: 'USD',
    },
    dnsSettings: {
      // Use Cloud DNS by default — we'll point the zone at Resend SPF/DKIM/DMARC
      // immediately after registration.
      googleDomainsDns: {
        dsState: 'DS_STATE_UNSPECIFIED',
      },
    },
    yearlyRenewalPrice: undefined as
      | { units: string; nanos: number; currencyCode: string }
      | undefined,
    contactNotices: ['PUBLIC_CONTACT_DATA_ACKNOWLEDGEMENT'],
    domainNotices: [] as string[],
  };

  // Drop empty optional so the API doesn't complain.
  delete (body as { yearlyRenewalPrice?: unknown }).yearlyRenewalPrice;

  return authedFetch<CloudDomainOperation>(`/${parent}/registrations:register`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Poll a long-running operation by name. */
export async function getOperation(operationName: string): Promise<CloudDomainOperation> {
  // Operation names are returned absolute (projects/.../operations/...).
  return authedFetch<CloudDomainOperation>(`/${operationName}`);
}

export function isConfigured(): boolean {
  return Boolean(process.env.GCP_SERVICE_ACCOUNT_JSON_B64 && process.env.GCP_PROJECT_ID);
}
