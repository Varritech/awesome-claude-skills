import { describe, it, expect } from 'vitest';
import { assertOwnership, ForbiddenError } from './data-isolation';

describe('assertOwnership', () => {
  const record = { userId: 'user_abc', data: 'value' };

  it('does not throw when userId matches record owner', () => {
    expect(() => assertOwnership('user_abc', record, 'inbox')).not.toThrow();
  });

  it('throws ForbiddenError when userId does not match', () => {
    expect(() => assertOwnership('user_other', record, 'inbox')).toThrow(ForbiddenError);
  });

  it('ForbiddenError has status 403', () => {
    try {
      assertOwnership('user_other', record, 'inbox');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).status).toBe(403);
    }
  });

  it('includes resourceType in error message', () => {
    try {
      assertOwnership('user_other', record, 'campaign');
    } catch (err) {
      expect((err as Error).message).toContain('campaign');
    }
  });

  it('includes the denied userId in error message', () => {
    try {
      assertOwnership('user_evil', record, 'lead');
    } catch (err) {
      expect((err as Error).message).toContain('user_evil');
    }
  });
});

describe('ForbiddenError', () => {
  it('is an instance of Error', () => {
    expect(new ForbiddenError()).toBeInstanceOf(Error);
  });

  it('has name ForbiddenError', () => {
    expect(new ForbiddenError().name).toBe('ForbiddenError');
  });

  it('uses default message when none provided', () => {
    expect(new ForbiddenError().message).toBe('Forbidden');
  });
});
