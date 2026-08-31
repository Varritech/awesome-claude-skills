/**
 * GET /api/track/[emailId]
 *
 * Email open tracking pixel.
 * - Sets openedAt on the email record (first open only)
 * - Returns a 1×1 transparent GIF
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// 1×1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { emailId: string } },
) {
  const { emailId } = params;

  if (emailId) {
    // Fire-and-forget: update Firestore without blocking the pixel response
    adminDb
      .collection('emails')
      .doc(emailId)
      .get()
      .then((snap) => {
        if (snap.exists && !snap.data()?.openedAt) {
          return snap.ref.set(
            { openedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { merge: true },
          );
        }
      })
      .catch((err) => {
        console.error('[track.pixel] Firestore update failed', err);
      });
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
