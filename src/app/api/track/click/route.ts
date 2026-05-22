/**
 * GET /api/track/click?eid=<emailId>&url=<encodedUrl>
 *
 * Click tracking redirect.
 * - Sets clickedAt on the email record (first click only)
 * - Redirects to the original URL
 * - Validates redirect target against app origin and user's verified tracking domains
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { jsonError } from '@/lib/api/helpers';

export const dynamic = 'force-dynamic';

async function isAllowedUrl(targetUrl: string, emailId: string | null): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;

  let parsed: URL;
  try {
    parsed = new URL(targetUrl, appUrl);
  } catch {
    return false;
  }

  // Allow same-origin (covers relative paths resolved against appUrl)
  if (parsed.origin === new URL(appUrl).origin) return true;

  // Allow verified tracking domains for the email's owner
  if (emailId) {
    try {
      const emailSnap = await adminDb.collection('emails').doc(emailId).get();
      const userId = emailSnap.exists ? emailSnap.data()?.userId : null;
      if (userId) {
        const snap = await adminDb
          .collection('trackingDomains')
          .where('userId', '==', userId)
          .where('verified', '==', true)
          .get();
        const domains = snap.docs.map((d) => d.data().domain as string);
        if (domains.includes(parsed.hostname)) return true;
      }
    } catch (err) {
      console.error('[track.click] Firestore domain lookup failed', err);
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('eid');
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL ?? '/', { status: 302 });
  }

  const allowed = await isAllowedUrl(targetUrl, emailId);
  if (!allowed) {
    return jsonError('Invalid redirect URL', 400);
  }

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

  return NextResponse.redirect(targetUrl, { status: 302 });
}
