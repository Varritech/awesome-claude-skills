/**
 * Audit logging for sensitive actions.
 * Writes events to the `auditLog` Firestore collection.
 */

import { adminDb } from '@/lib/firebase/admin';

export type AuditAction =
  | 'inbox_connected'
  | 'inbox_deleted'
  | 'campaign_started'
  | 'campaign_paused'
  | 'leads_exported'
  | 'suppression_added';

export interface AuditEvent {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const event: AuditEvent = {
    id,
    userId,
    action,
    resourceType,
    resourceId,
    ...(metadata ? { metadata } : {}),
    createdAt: new Date().toISOString(),
  };

  try {
    await adminDb.collection('auditLog').doc(id).set(event);
  } catch (err) {
    // Audit logging must never break the main flow.
    console.warn('[audit] failed to write event', action, err);
  }
}
