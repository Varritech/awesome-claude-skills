import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore admin
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

import { logAuditEvent } from './logger';
import { adminDb } from '@/lib/firebase/admin';

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an event to the auditLog collection', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
    (adminDb.collection as ReturnType<typeof vi.fn>).mockImplementation(mockCollection);

    await logAuditEvent('user_1', 'inbox_connected', 'inbox', 'ib_123');

    expect(mockCollection).toHaveBeenCalledWith('auditLog');
    expect(mockDoc).toHaveBeenCalledWith(expect.stringContaining('audit_'));
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        action: 'inbox_connected',
        resourceType: 'inbox',
        resourceId: 'ib_123',
        createdAt: expect.any(String),
      }),
    );
  });

  it('includes metadata when provided', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({ set: mockSet }),
    } as ReturnType<typeof vi.fn>);

    await logAuditEvent('user_1', 'campaign_started', 'campaign', 'cmp_1', { step: 'launch' });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { step: 'launch' } }),
    );
  });

  it('does not throw when Firestore write fails (fire and forget)', async () => {
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockRejectedValue(new Error('Firestore down')),
      }),
    } as ReturnType<typeof vi.fn>);

    // Should not throw
    await expect(
      logAuditEvent('user_1', 'leads_exported', 'lead', 'ld_1'),
    ).resolves.toBeUndefined();
  });
});
