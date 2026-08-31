import { describe, it, expect } from 'vitest';

// ── Pure check logic (mirrors checklist/route.ts) ────────────────────────────

function checkSmtpKey(env: Record<string, string | undefined>): boolean {
  const key = env['SMTP_ENCRYPTION_KEY'];
  return !!(key && key.length === 64);
}

function checkFirebaseEnv(env: Record<string, string | undefined>): boolean {
  return !!(
    env['FIREBASE_ADMIN_PROJECT_ID'] &&
    env['FIREBASE_ADMIN_CLIENT_EMAIL'] &&
    env['FIREBASE_ADMIN_PRIVATE_KEY']
  );
}

function checkClerkWebhookSecret(env: Record<string, string | undefined>): boolean {
  return !!env['CLERK_WEBHOOK_SECRET'];
}

function scoreChecks(checks: boolean[]): number {
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('security checklist checks', () => {
  describe('checkSmtpKey', () => {
    it('passes with a valid 64-char hex key', () => {
      expect(checkSmtpKey({ SMTP_ENCRYPTION_KEY: 'a'.repeat(64) })).toBe(true);
    });

    it('fails when key is too short', () => {
      expect(checkSmtpKey({ SMTP_ENCRYPTION_KEY: 'abc' })).toBe(false);
    });

    it('fails when key is missing', () => {
      expect(checkSmtpKey({})).toBe(false);
    });
  });

  describe('checkFirebaseEnv', () => {
    it('passes when all three vars are set', () => {
      expect(
        checkFirebaseEnv({
          FIREBASE_ADMIN_PROJECT_ID: 'proj',
          FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@proj.iam.gserviceaccount.com',
          FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----',
        }),
      ).toBe(true);
    });

    it('fails when one var is missing', () => {
      expect(
        checkFirebaseEnv({
          FIREBASE_ADMIN_PROJECT_ID: 'proj',
          FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@proj.iam.gserviceaccount.com',
        }),
      ).toBe(false);
    });
  });

  describe('checkClerkWebhookSecret', () => {
    it('passes when secret is set', () => {
      expect(checkClerkWebhookSecret({ CLERK_WEBHOOK_SECRET: 'whsec_abc' })).toBe(true);
    });

    it('fails when secret is missing', () => {
      expect(checkClerkWebhookSecret({})).toBe(false);
    });
  });

  describe('scoreChecks', () => {
    it('returns 100 when all checks pass', () => {
      expect(scoreChecks([true, true, true, true])).toBe(100);
    });

    it('returns 0 when all checks fail', () => {
      expect(scoreChecks([false, false, false, false])).toBe(0);
    });

    it('returns 50 when half pass', () => {
      expect(scoreChecks([true, false, true, false])).toBe(50);
    });

    it('rounds to nearest integer', () => {
      // 1 of 3 = 33.33% → 33
      expect(scoreChecks([true, false, false])).toBe(33);
    });
  });
});
