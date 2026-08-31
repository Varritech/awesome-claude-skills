/**
 * Email content compliance checker.
 *
 * Checks for CAN-SPAM requirements, deceptive subject lines,
 * and recommended body length range.
 *
 * Rules:
 * - Must have unsubscribe link OR physical mailing address (CAN-SPAM)
 * - No deceptive subject line patterns
 * - Body length 50-2000 chars recommended
 *
 * Errors block sending; warnings are advisory only.
 */

export interface ComplianceInput {
  subject: string;
  body: string;
}

export interface ComplianceResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

/** Patterns that indicate a deceptive or forbidden subject line. */
const FORBIDDEN_SUBJECT_PATTERNS: RegExp[] = [
  /re:/i, // Faking a reply thread
  /fwd:/i, // Faking a forward
  /fw:/i, // Faking a forward (abbreviated)
  /\bfree\b.*\bguarantee/i, // "free ... guarantee"
  /\b(100%\s*free|completely\s*free)\b/i,
  /\bcongratulations\b.*\bwon\b/i,
  /\byou\s*won\b/i,
  /\burgent\b.*\baction\s*required\b/i,
  /!!!+/, // Excessive exclamation marks
  /\$\$\$/, // Dollar signs spamming
  /\bBUY NOW\b/i,
  /\bACT NOW\b/i,
];

const UNSUBSCRIBE_PATTERNS = [
  /unsubscribe/i,
  /opt.?out/i,
  /manage.*preferences/i,
  /remove.*from.*list/i,
  /click.*here.*to.*stop/i,
];

const PHYSICAL_ADDRESS_PATTERN =
  /\d{1,5}\s+[\w\s.,-]+(?:street|st|avenue|ave|road|rd|blvd|boulevard|drive|dr|lane|ln|way|court|ct|plaza|pkwy|parkway)[,.\s]+[\w\s]+(?:[A-Z]{2})\s+\d{5}/i;

const MIN_BODY_LENGTH = 50;
const MAX_BODY_LENGTH_RECOMMENDED = 2000;

export function checkCompliance(email: ComplianceInput): ComplianceResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── 1. CAN-SPAM: unsubscribe or physical address ─────────────────────────
  const hasUnsubscribe = UNSUBSCRIBE_PATTERNS.some((p) => p.test(email.body));
  const hasPhysicalAddress = PHYSICAL_ADDRESS_PATTERN.test(email.body);

  if (!hasUnsubscribe && !hasPhysicalAddress) {
    errors.push(
      "Email must include an unsubscribe link or physical mailing address (CAN-SPAM requirement)."
    );
  }

  // ── 2. Deceptive subject line ─────────────────────────────────────────────
  for (const pattern of FORBIDDEN_SUBJECT_PATTERNS) {
    if (pattern.test(email.subject)) {
      errors.push(
        `Subject line may be deceptive or spam-triggering: matches pattern "${pattern.source}".`
      );
      break; // one error per subject is enough
    }
  }

  // ── 3. Body length ────────────────────────────────────────────────────────
  const bodyLength = email.body.length;
  if (bodyLength < MIN_BODY_LENGTH) {
    warnings.push(
      `Email body is very short (${bodyLength} chars). Recommended minimum is ${MIN_BODY_LENGTH} characters.`
    );
  } else if (bodyLength > MAX_BODY_LENGTH_RECOMMENDED) {
    warnings.push(
      `Email body is long (${bodyLength} chars). Recommended maximum is ${MAX_BODY_LENGTH_RECOMMENDED} characters for cold outreach.`
    );
  }

  // ── 4. Empty subject ─────────────────────────────────────────────────────
  if (!email.subject.trim()) {
    warnings.push(
      "Subject line is empty. Emails without a subject are more likely to be filtered."
    );
  }

  return {
    passed: errors.length === 0,
    warnings,
    errors,
  };
}
