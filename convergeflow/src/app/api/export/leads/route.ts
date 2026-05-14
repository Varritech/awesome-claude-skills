/**
 * GET /api/export/leads
 *
 * Streams a CSV of all the authenticated user's leads.
 * Headers: id,firstName,lastName,email,company,title,industry,location,
 *          status,source,tags,engagementScore,createdAt
 */

import { requireUser, logRequest } from '@/lib/api/helpers';
import { adminDb } from '@/lib/firebase/admin';
import { leadsToCSV, type LeadExportRow } from '@/lib/export/csv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  logRequest('export.leads.GET', userId);

  const snap = await adminDb
    .collection('leads')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  const leads: LeadExportRow[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      company: data.company,
      title: data.title,
      industry: data.industry,
      location: data.location,
      status: data.status,
      source: data.source,
      tags: data.tags,
      engagementScore: data.engagementScore,
      createdAt: data.createdAt,
    };
  });

  const csv = leadsToCSV(leads);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
