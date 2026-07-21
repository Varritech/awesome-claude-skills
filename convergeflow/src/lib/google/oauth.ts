/**
 * Minimal Google OAuth helpers for the inbox-connect flow.
 *
 * Kept as a thin, mockable seam over Google's HTTP endpoints so route handlers
 * (and their tests) never touch `fetch` directly. The token-refresh Inngest job
 * owns ongoing access-token renewal; this module only handles the one-time
 * authorization-code exchange and the initial email lookup.
 */

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresInSec?: number;
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * `redirectUri` must byte-match the one used to build the consent URL.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${detail}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSec: json.expires_in,
  };
}

/** Resolve the connected mailbox's email address from an access token. */
export async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google userinfo lookup failed: ${res.status} ${detail}`);
  }

  const json = (await res.json()) as { email?: string };
  if (!json.email) {
    throw new Error('Google userinfo response contained no email');
  }
  return json.email;
}
