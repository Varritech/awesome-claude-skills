/**
 * GET /api/track/click?eid=<emailId>&url=<encodedUrl>
 *
 * Click tracking redirect.
 * - Sets clickedAt on the email record (first click only)
 * - Redirects to the original URL
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('eid');
  const targetUrl = searchParams.get('url');

  // Fallback to homepage if URL is missing or invalid
  const redirectTo = targetUrl ?? '/';

  if (emailId) {
    adminDb
      .collection('emails')
      .doc(emailId)
      .get()
      .then((snap) => {
        if (snap.exists && !snap.data()?.clickedAt) {
          return snap.ref.set(
            { clickedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { merge: true },
          );
        }
      })
      .catch((err) => {
        console.error('[track.click] Firestore update failed', err);
      });
  }

  return NextResponse.redirect(redirectTo, { status: 302 });
}
