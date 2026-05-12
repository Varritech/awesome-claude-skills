import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptPassword, decryptPassword } from "./mailer";

// Valid 64-char hex key (32 bytes) for tests
const TEST_KEY = "a".repeat(64);

beforeAll(() => {
  process.env.SMTP_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.SMTP_ENCRYPTION_KEY;
});

describe("encryptPassword / decryptPassword", () => {
  it("round-trips a plaintext password", () => {
    const plain = "super-secret-pass!";
    const encrypted = encryptPassword(plain);
    expect(decryptPassword(encrypted)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const encrypted1 = encryptPassword("same-password");
    const encrypted2 = encryptPassword("same-password");
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("encrypted format is iv:tag:ciphertext (3 colon-separated hex parts)", () => {
    const encrypted = encryptPassword("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // GCM auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // ciphertext is non-empty
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptPassword("test");
    const parts = encrypted.split(":");
    // Flip one byte in the ciphertext
    const badCipher = parts[2]!.slice(0, -2) + "00";
    const tampered = `${parts[0]}:${parts[1]}:${badCipher}`;
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it("throws when format is wrong (missing colons)", () => {
    expect(() => decryptPassword("notvalidformat")).toThrow("Invalid encrypted password format");
  });

  it("handles empty string password", () => {
    const encrypted = encryptPassword("");
    expect(decryptPassword(encrypted)).toBe("");
  });

  it("handles passwords with special characters", () => {
    const plain = "p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?/\\`~\"'";
    expect(decryptPassword(encryptPassword(plain))).toBe(plain);
  });
});

describe("encryptionKey validation", () => {
  it("throws when SMTP_ENCRYPTION_KEY is missing", () => {
    const orig = process.env.SMTP_ENCRYPTION_KEY;
    delete process.env.SMTP_ENCRYPTION_KEY;
    expect(() => encryptPassword("x")).toThrow("SMTP_ENCRYPTION_KEY");
    process.env.SMTP_ENCRYPTION_KEY = orig;
  });

  it("throws when SMTP_ENCRYPTION_KEY is wrong length", () => {
    const orig = process.env.SMTP_ENCRYPTION_KEY;
    process.env.SMTP_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptPassword("x")).toThrow("64-char hex string");
    process.env.SMTP_ENCRYPTION_KEY = orig;
  });
});
