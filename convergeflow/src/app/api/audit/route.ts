/**
 * GET /api/audit — returns last 100 audit events (admin only).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, logRequest, jsonError } from '@/lib/api/helpers';
import type { AuditEvent } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

// Simple admin check — in production, verify against a list of admin user IDs or Clerk role
function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);
  if (adminIds.length === 0) return false; // no admins configured
  return adminIds.includes(userId);
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  if (!isAdmin(userId)) {
    return jsonError('Forbidden', 403);
  }

  logRequest('audit.GET', userId);

  try {
    const snap = await adminDb
      .collection('auditLog')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const events = snap.docs.map((d) => d.data() as AuditEvent);
    return NextResponse.json({ data: events });
  } catch (err) {
    console.warn('[api:audit.GET] error', err);
    return NextResponse.json({ data: [] });
  }
}
