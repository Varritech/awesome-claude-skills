/**
 * Suppression and DNC check utilities.
 *
 * Used by the email send pipeline to determine whether an email address
 * is suppressed (user-level) or on the global DNC list (system-level).
 */

import { adminDb } from "@/lib/firebase/admin";

/**
 * Check whether an email is on the user-level suppression list.
 */
export async function isEmailSuppressed(userId: string, email: string): Promise<boolean> {
  const normalised = email.toLowerCase().trim();
  const snap = await adminDb
    .collection("suppressions")
    .where("userId", "==", userId)
    .where("email", "==", normalised)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Check whether an email is on the global DNC (do-not-contact) list.
 */
export async function isEmailOnDnc(email: string): Promise<boolean> {
  const normalised = email.toLowerCase().trim();
  const snap = await adminDb.collection("dnc").where("email", "==", normalised).limit(1).get();
  return !snap.empty;
}

/**
 * Add an email to the user-level suppression list.
 */
export async function addSuppression(
  userId: string,
  email: string,
  reason: "unsubscribed" | "bounced" | "manual" = "manual"
): Promise<void> {
  const normalised = email.toLowerCase().trim();
  const id = `sup_${userId}_${Buffer.from(normalised)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16)}`;
  const now = new Date().toISOString();
  await adminDb
    .collection("suppressions")
    .doc(id)
    .set({ id, userId, email: normalised, reason, createdAt: now }, { merge: true });
}
