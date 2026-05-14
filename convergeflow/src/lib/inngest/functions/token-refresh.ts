/**
 * Inngest scheduled function: token-refresh
 * Runs every 6 hours. Refreshes OAuth access tokens for Gmail/Outlook inboxes
 * that expire within the next 24 hours.
 */

import { inngest } from '../client';
import { adminDb } from '@/lib/firebase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokens';

interface InboxRecord {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook' | string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  updatedAt: string;
}

interface OAuthRefreshResult {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

async function refreshGoogleToken(encryptedRefreshToken: string): Promise<OAuthRefreshResult> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<OAuthRefreshResult>;
}

async function refreshMicrosoftToken(encryptedRefreshToken: string): Promise<OAuthRefreshResult> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://outlook.office.com/SMTP.Send offline_access',
  });

  const tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<OAuthRefreshResult>;
}

export const tokenRefreshFn = inngest.createFunction(
  {
    id: 'token-refresh',
    name: 'OAuth Token Refresh',
    triggers: [
      { event: 'inngest/function.invoked' as never }, // cron trigger below
      {
        cron: '0 */6 * * *', // every 6 hours
      } as never,
    ],
  },
  async ({ step }) => {
    const expiryThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Load inboxes expiring within 24h
    const inboxes = await step.run('load-expiring-inboxes', async () => {
      try {
        const snap = await adminDb
          .collection('inboxes')
          .where('provider', 'in', ['gmail', 'outlook'])
          .where('tokenExpiresAt', '<=', expiryThreshold)
          .get();
        return snap.docs.map((d) => d.data() as InboxRecord);
      } catch {
        return [];
      }
    });

    const results: Array<{ inboxId: string; success: boolean; error?: string }> = [];

    for (const inbox of inboxes) {
      const result = await step.run(`refresh-token-${inbox.id}`, async () => {
        if (!inbox.refreshToken) {
          return { inboxId: inbox.id, success: false, error: 'No refresh token stored' };
        }

        try {
          let refreshed: OAuthRefreshResult;

          if (inbox.provider === 'gmail') {
            refreshed = await refreshGoogleToken(inbox.refreshToken);
          } else if (inbox.provider === 'outlook') {
            refreshed = await refreshMicrosoftToken(inbox.refreshToken);
          } else {
            return { inboxId: inbox.id, success: false, error: 'Unknown provider' };
          }

          const newExpiresAt = new Date(
            Date.now() + refreshed.expires_in * 1000,
          ).toISOString();

          await adminDb.collection('inboxes').doc(inbox.id).set(
            {
              accessToken: encryptToken(refreshed.access_token),
              tokenExpiresAt: newExpiresAt,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );

          return { inboxId: inbox.id, success: true };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.warn(`[token-refresh] failed for inbox ${inbox.id}:`, error);
          return { inboxId: inbox.id, success: false, error };
        }
      });

      results.push(result);
    }

    return { processed: inboxes.length, results };
  },
);
