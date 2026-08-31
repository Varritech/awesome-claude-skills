import { describe, it, expect } from 'vitest';
import { createSignatureSchema } from './route';

describe('createSignatureSchema', () => {
  it('accepts valid signature data', () => {
    const result = createSignatureSchema.safeParse({
      name: 'My Signature',
      html: '<p>Best, John</p>',
      isDefault: false,
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = createSignatureSchema.safeParse({
      name: '',
      html: '<p>sig</p>',
    });
    expect(result.success).toBe(false);
  });

  it('requires html', () => {
    const result = createSignatureSchema.safeParse({
      name: 'Test',
      html: '',
    });
    expect(result.success).toBe(false);
  });

  it('defaults isDefault to false', () => {
    const result = createSignatureSchema.safeParse({
      name: 'My Sig',
      html: '<p>sig</p>',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDefault).toBe(false);
    }
  });

  it('allows isDefault: true', () => {
    const result = createSignatureSchema.safeParse({
      name: 'Default Sig',
      html: '<p>sig</p>',
      isDefault: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDefault).toBe(true);
    }
  });

  it('rejects name longer than 80 chars', () => {
    const result = createSignatureSchema.safeParse({
      name: 'a'.repeat(81),
      html: '<p>sig</p>',
    });
    expect(result.success).toBe(false);
  });
});
