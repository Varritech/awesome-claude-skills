/**
 * POST /api/leads/bulk
 *
 * Executes bulk operations on multiple leads at once.
 *
 * Actions:
 *   delete  — soft-delete (sets deletedAt)
 *   tag     — adds tags (value is comma-separated tag string)
 *   untag   — removes tags
 *   status  — sets status to `value`
 *
 * Firestore batches are capped at 500 writes. Larger sets are chunked
 * automatically into sequential batches.
 */

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, logRequest, parseAndValidate, requireUser } from "@/lib/api/helpers";
import { bulkLeadActionSchema, leadStatusSchema } from "@/lib/schemas/lead";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, bulkLeadActionSchema);
  if (parsed.response) return parsed.response;
  const { action, leadIds, value } = parsed.data;

  logRequest("leads.bulk.POST", userId, { action, count: leadIds.length, value });

  // Validate action-specific requirements
  if (action === "status") {
    if (!value) return jsonError("value is required for status action", 400);
    const statusCheck = leadStatusSchema.safeParse(value);
    if (!statusCheck.success) {
      return jsonError(`Invalid status: ${value}`, 400);
    }
  }
  if ((action === "tag" || action === "untag") && !value) {
    return jsonError("value is required for tag/untag actions", 400);
  }

  try {
    const now = new Date().toISOString();
    let affected = 0;

    for (const ids of chunk(leadIds, BATCH_SIZE)) {
      // Verify ownership of each lead in the chunk
      const refs = ids.map((id) => adminDb.collection("leads").doc(id));
      const snaps = await adminDb.getAll(...refs);

      const batch = adminDb.batch();

      for (const snap of snaps) {
        if (!snap.exists) continue;
        const data = snap.data() as { userId: string };
        if (data.userId !== userId) continue;

        switch (action) {
          case "delete":
            batch.set(snap.ref, { deletedAt: now, updatedAt: now }, { merge: true });
            break;
          case "tag": {
            const tags = (value as string)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            batch.set(
              snap.ref,
              { tags: FieldValue.arrayUnion(...tags), updatedAt: now },
              { merge: true }
            );
            break;
          }
          case "untag": {
            const tags = (value as string)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            batch.set(
              snap.ref,
              { tags: FieldValue.arrayRemove(...tags), updatedAt: now },
              { merge: true }
            );
            break;
          }
          case "status":
            batch.set(
              snap.ref,
              { status: value, statusUpdatedAt: now, updatedAt: now },
              { merge: true }
            );
            break;
        }

        affected++;
      }

      await batch.commit();
    }

    return NextResponse.json({ data: { action, affected } });
  } catch (err) {
    console.error("[api:leads.bulk.POST]", err);
    return jsonError("Failed to execute bulk action", 500);
  }
}
