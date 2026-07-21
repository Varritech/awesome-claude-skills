/**
 * GET /api/inboxes/callback/google
 *
 * OAuth redirect target for the Gmail inbox connection. Google sends the user
 * here with `?code=...&state=<inboxId>` after consent. We exchange the code for
 * tokens, resolve the mailbox email, and flip the pending inbox record to
 * `connected` (starting warmup). On any failure we bounce the user back to the
 * inbox step with an `?error=` marker rather than leaving them on a blank page.
 *
 * The consent URL is built in ../../route.ts (buildGmailAuthUrl); the ongoing
 * access-token renewal is handled by the token-refresh Inngest job. Token field
 * names here (`accessToken`, `refreshToken`, `tokenExpiresAt`) must match that
 * job's expectations.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, logRequest } from '@/lib/api/helpers';
import { exchangeCodeForTokens, getGoogleEmail } from '@/lib/google/oauth';
import { encryptToken } from '@/lib/crypto/tokens';

export const dynamic = 'force-dynamic';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://convergeflow-push.vercel.app';
}

function errorRedirect(reason: string): NextResponse {
  return NextResponse.redirect(`${appUrl()}/onboarding/inbox?error=${reason}`);
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // inbox id set when the consent URL was built
  const consentError = url.searchParams.get('error');

  logRequest('inboxes.callback.google', userId, { state, hasCode: Boolean(code) });

  if (consentError || !code || !state) {
    return errorRedirect('oauth_denied');
  }

  // Ownership check: the signed-in user must own the pending inbox in `state`.
  let inbox: { userId?: string } | undefined;
  try {
    const snap = await adminDb.collection('inboxes').doc(state).get();
    inbox = snap.exists ? (snap.data() as { userId?: string }) : undefined;
  } catch (err) {
    console.warn('[api:inboxes.callback.google] inbox lookup failed', err);
    return errorRedirect('inbox_not_found');
  }
  if (!inbox || inbox.userId !== userId) {
    return errorRedirect('inbox_not_found');
  }

  // Exchange the authorization code and resolve the mailbox address.
  let email: string;
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    const redirectUri = `${appUrl()}/api/inboxes/callback/google`;
    tokens = await exchangeCodeForTokens(code, redirectUri);
    email = await getGoogleEmail(tokens.accessToken);
  } catch (err) {
    console.warn('[api:inboxes.callback.google] token exchange failed', err);
    return errorRedirect('oauth_failed');
  }

  const now = new Date().toISOString();
  const tokenExpiresAt = new Date(
    Date.now() + (tokens.expiresInSec ?? 3600) * 1000,
  ).toISOString();

  try {
    await adminDb.collection('inboxes').doc(state).set(
      {
        email,
        status: 'connected',
        warmupStartDate: now,
        accessToken: encryptToken(tokens.accessToken),
        ...(tokens.refreshToken ? { refreshToken: encryptToken(tokens.refreshToken) } : {}),
        tokenExpiresAt,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[api:inboxes.callback.google] firestore update failed', err);
    return errorRedirect('persist_failed');
  }

  return NextResponse.redirect(`${appUrl()}/onboarding/industry?inbox=connected`);
}
