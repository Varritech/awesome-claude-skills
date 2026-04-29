import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // inbox record ID
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://convergeflow-push.vercel.app';

  // Resolve userId from the existing inbox doc (set during POST /api/inboxes)
  // so we can attach it if the doc needs to be created from scratch.
  let userId: string | undefined;
  if (state) {
    try {
      const existing = await adminDb.collection('inboxes').doc(state).get();
      userId = existing.exists ? (existing.data()?.userId as string | undefined) : undefined;
    } catch {
      // best-effort
    }
    if (!userId) {
      // fallback: try to get from Clerk session (may not be available in redirect)
      try {
        const auth = await requireUser();
        if (!auth.response) userId = auth.userId;
      } catch {
        // ignore
      }
    }
  }

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/onboarding/inbox?error=oauth_denied`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/inboxes/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[gmail-callback] token exchange failed', await tokenRes.text());
      return NextResponse.redirect(`${appUrl}/onboarding/inbox?error=token_exchange`);
    }

    const tokens = await tokenRes.json();

    // Get the user's Gmail address
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const email = userInfo.email as string;

    // Update or create the inbox record in Firestore
    if (state) {
      const update = {
        email,
        status: 'warming',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const ref = adminDb.collection('inboxes').doc(state);
        const snap = await ref.get();
        if (snap.exists) {
          await ref.update(update);
        } else {
          await ref.set({
            id: state,
            provider: 'gmail',
            status: 'warming',
            warmupEnabled: true,
            dailySendLimit: 50,
            createdAt: new Date().toISOString(),
            ...(userId ? { userId } : {}),
            ...update,
          });
        }
      } catch (fsErr) {
        console.warn('[gmail-callback] firestore update failed (continuing)', fsErr);
      }
    }

    return NextResponse.redirect(`${appUrl}/onboarding/industry?inbox=connected`);
  } catch (err) {
    console.error('[gmail-callback] error', err);
    return NextResponse.redirect(`${appUrl}/onboarding/inbox?error=callback_failed`);
  }
}
