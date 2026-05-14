/**
 * Application-level data isolation (row-level security equivalent).
 *
 * ConvergeFlow uses Firestore (not Supabase), so ownership checks are
 * enforced in the application layer before any read/write operation.
 */

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Asserts that `userId` owns `record`.
 * Throws `ForbiddenError` if they don't match.
 *
 * @example
 *   assertOwnership(userId, inbox, 'inbox');
 */
export function assertOwnership(
  userId: string,
  record: { userId: string },
  resourceType: string,
): void {
  if (record.userId !== userId) {
    throw new ForbiddenError(
      `Access denied: user ${userId} does not own this ${resourceType}`,
    );
  }
}
