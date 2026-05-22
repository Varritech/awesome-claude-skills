/**
 * Lead deduplication engine.
 *
 * `deduplicateLeads` queries Firestore for existing leads with the same
 * email address (case-insensitive) and partitions the incoming array into
 * unique and duplicate groups.
 *
 * Leads without an email address are always treated as unique (we can't
 * deduplicate on an empty key).
 */

import { adminDb } from "@/lib/firebase/admin";

export interface LeadInput {
  email?: string;
  [key: string]: unknown;
}

export interface DeduplicationResult<T extends LeadInput> {
  unique: T[];
  duplicates: T[];
}

/**
 * Partition `incoming` leads into unique / duplicate by checking whether
 * their email already exists in Firestore for the given user.
 *
 * Complexity: one Firestore `where-in` query per batch of 30 emails
 * (Firestore `in` limit is 30).
 */
export async function deduplicateLeads<T extends LeadInput>(
  userId: string,
  incoming: T[]
): Promise<DeduplicationResult<T>> {
  if (incoming.length === 0) {
    return { unique: [], duplicates: [] };
  }

  // Separate leads without email — they're always unique
  const withEmail = incoming.filter((l) => l.email);
  const withoutEmail = incoming.filter((l) => !l.email);

  if (withEmail.length === 0) {
    return { unique: incoming, duplicates: [] };
  }

  // Normalise to lowercase
  const normalise = (e: string) => e.toLowerCase().trim();
  const incomingEmails = withEmail.map((l) => normalise(l.email!));

  // Firestore `in` supports up to 30 values per query
  const CHUNK_SIZE = 30;
  const existingEmails = new Set<string>();

  for (let i = 0; i < incomingEmails.length; i += CHUNK_SIZE) {
    const chunk = incomingEmails.slice(i, i + CHUNK_SIZE);
    const snap = await adminDb
      .collection("leads")
      .where("userId", "==", userId)
      .where("email", "in", chunk)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data() as { email?: string };
      if (data.email) existingEmails.add(normalise(data.email));
    }
  }

  const unique: T[] = [...withoutEmail];
  const duplicates: T[] = [];

  // Track emails seen within the incoming batch to de-dup within the batch too
  const seenInBatch = new Set<string>();

  for (const lead of withEmail) {
    const norm = normalise(lead.email!);
    if (existingEmails.has(norm) || seenInBatch.has(norm)) {
      duplicates.push(lead);
    } else {
      seenInBatch.add(norm);
      unique.push(lead);
    }
  }

  return { unique, duplicates };
}
