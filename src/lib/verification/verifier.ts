/**
 * Email verification pipeline.
 *
 * verifyEmail performs two checks:
 *   1. RFC-5321 compliant email regex
 *   2. DNS MX record lookup to confirm the domain can receive mail
 *
 * This is a lightweight first-pass check. It does not send a verification
 * email or probe the SMTP server — that would require a full SMTP handshake.
 */

import dns from "node:dns/promises";

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

// RFC-5321 simplified regex — catches the most common invalid formats
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Verify an email address by checking format and MX record existence.
 *
 * @param email  The email address to verify
 * @returns      { valid: true } or { valid: false, reason: string }
 */
export async function verifyEmail(email: string): Promise<VerificationResult> {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Email must be a non-empty string" };
  }

  const trimmed = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: "Invalid email format" };
  }

  const domain = trimmed.split("@")[1]!;

  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: `No MX records found for domain: ${domain}` };
    }
    return { valid: true };
  } catch (err) {
    // DNS errors: ENOTFOUND, ENODATA, SERVFAIL, etc.
    const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
    return {
      valid: false,
      reason: `MX lookup failed for domain ${domain}: ${code}`,
    };
  }
}
