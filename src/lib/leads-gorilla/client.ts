/**
 * Leads Gorilla HTTP client.
 *
 * Wraps the leadsgorilla.io REST API for searching local businesses.
 * API key is read from LEADS_GORILLA_API_KEY environment variable.
 *
 * Reference: https://api.leadsgorilla.io
 */

export interface LeadsGorillaBusinessResult {
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
}

export interface SearchBusinessesOptions {
  keyword: string;
  location: string;
  limit?: number;
}

export interface SearchBusinessesResult {
  businesses: LeadsGorillaBusinessResult[];
}

export interface LeadsGorillaClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class LeadsGorillaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: LeadsGorillaClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.LEADS_GORILLA_API_KEY;
    if (!apiKey) {
      throw new Error("LeadsGorillaClient: LEADS_GORILLA_API_KEY environment variable is not set");
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.leadsgorilla.io";
  }

  /**
   * Search for businesses by keyword and location.
   *
   * @param keyword   Business type / niche (e.g. "plumbers", "dentists")
   * @param location  City, region, or address string
   * @param limit     Max number of results to return (default 50)
   */
  async searchBusinesses(opts: SearchBusinessesOptions): Promise<SearchBusinessesResult> {
    const { keyword, location, limit = 50 } = opts;

    const url = new URL("/v1/search", this.baseUrl);
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("location", location);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`LeadsGorillaClient: HTTP ${res.status} from ${url.pathname} — ${text}`);
    }

    const json = (await res.json()) as { businesses?: LeadsGorillaBusinessResult[] };

    return {
      businesses: json.businesses ?? [],
    };
  }
}

// Singleton factory — instantiates once per process using env vars
let _client: LeadsGorillaClient | undefined;

export function getLeadsGorillaClient(): LeadsGorillaClient {
  if (!_client) {
    _client = new LeadsGorillaClient();
  }
  return _client;
}
