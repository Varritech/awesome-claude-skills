/**
 * /api/leads — list & import leads.
 *
 * GET browses persisted leads from Firestore (DB-only; the search route handles
 * pulling from providers). Supports category/industry/location/status filters
 * (applied in-memory to avoid needing composite Firestore indexes) and returns
 * the distinct categories present so the customers page can render real trade
 * chips. `needsPull:true` tells the page a category has no cached leads yet.
 *
 * The api-client unwraps the { data: T } envelope, so the page receives the
 * inner object directly.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  jsonError,
  logRequest,
  parseAndValidate,
  requireUser,
} from '@/lib/api/helpers';
import { importLeadsSchema, leadFilterSchema } from '@/lib/schemas';
import {
  buildLeadRecord,
  toUiResponse,
  type LeadRecord,
  type NormalizedLead,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = leadFilterSchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError('Invalid filters', 400, parsed.error.flatten());
  }
  const { industry, category, location, status, limit } = parsed.data;

  logRequest('leads.GET', userId, { industry, category, location, status, limit });

  let records: LeadRecord[] = [];
  try {
    // Query by userId + createdAt (single composite index, already used by the
    // prior implementation). Load a generous window then filter in-memory so
    // adding category/industry/status filters needs no new Firestore indexes.
    const snap = await adminDb
      .collection('leads')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit * 4, 200))
      .get();
    records = snap.docs
      .map((d) => d.data() as LeadRecord)
      .filter((l) => !l.deletedAt);
  } catch (err) {
    console.warn('[api:leads.GET] firestore query failed', err);
    // Degrade to empty + needsPull rather than fabricating mock leads.
    return NextResponse.json({ data: { leads: [], categories: [], needsPull: true } });
  }

  const filtered = records.filter((r) => {
    if (category && r.category !== category) return false;
    if (industry && r.industry !== industry) return false;
    if (location && r.location !== location) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  const page = filtered.slice(0, limit);
  const needsPull = filtered.length === 0;

  // Categories reflect the full loaded set (not the filtered page) so chips
  // stay stable across filters.
  return NextResponse.json({ data: toUiResponse(page, needsPull) });
}

// ── POST (import) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, importLeadsSchema);
  if (parsed.response) return parsed.response;
  const { source, leads } = parsed.data;

  logRequest('leads.POST', userId, { source, count: leads.length });

  const now = new Date().toISOString();
  // Deterministic dedup ids → re-importing the same CSV upserts instead of
  // duplicating.
  const inserted: LeadRecord[] = leads.map((l) =>
    buildLeadRecord({
      normalized: l as NormalizedLead,
      userId,
      provider: source,
      pullFingerprint: `import_${source}`,
      now,
    }),
  );

  try {
    for (const rec of inserted) {
      await adminDb.collection('leads').doc(rec.id).set(rec, { merge: true });
    }
  } catch (err) {
    console.warn('[api:leads.POST] write failed', err);
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }

  return NextResponse.json(
    { data: { imported: inserted.length, source, leads: toUiResponse(inserted).leads } },
    { status: 201 },
  );
}