/**
 * Calendly API v2 client.
 *
 * Reads CALENDLY_API_KEY from env.
 * `getSchedulingLink` fetches the user's primary scheduling URL.
 */

const CALENDLY_API_BASE = "https://api.calendly.com";

export class CalendlyClient {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.CALENDLY_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("CALENDLY_API_KEY is not set");
    }
  }

  private async fetch<T>(path: string): Promise<T> {
    const res = await fetch(`${CALENDLY_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Calendly API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Get the primary scheduling link for a user.
   * First tries their profile's calendlyUrl, then fetches from API.
   */
  async getSchedulingLink(calendlyUrl?: string): Promise<string> {
    if (calendlyUrl) return calendlyUrl;

    // Fetch the current user's scheduling URL from Calendly API
    const data = await this.fetch<{ resource: { scheduling_url: string } }>("/users/me");
    return data.resource.scheduling_url;
  }

  /**
   * List scheduled events for the authenticated user.
   */
  async listEvents(options?: { count?: number; status?: "active" | "canceled" }) {
    const params = new URLSearchParams();
    if (options?.count) params.set("count", String(options.count));
    if (options?.status) params.set("status", options.status);

    const userRes = await this.fetch<{ resource: { uri: string } }>("/users/me");
    params.set("user", userRes.resource.uri);

    return this.fetch<{ collection: unknown[] }>(`/scheduled_events?${params}`);
  }
}

let _calendlyClient: CalendlyClient | null = null;

/**
 * Lazy singleton — only instantiated on first access so tests that don't
 * set CALENDLY_API_KEY don't throw at module load time.
 */
export function getCalendlyClient(): CalendlyClient {
  if (!_calendlyClient) {
    _calendlyClient = new CalendlyClient(process.env.CALENDLY_API_KEY);
  }
  return _calendlyClient;
}
