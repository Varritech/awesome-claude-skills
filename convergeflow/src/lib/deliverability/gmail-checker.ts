/**
 * Gmail/Gemini spam awareness system.
 *
 * Heuristic scoring for an email's spam risk before it is sent.
 * Returns a 0–100 risk score and a list of flagged issues.
 * Score > 50 should surface warnings in the UI.
 */

export interface SpamCheckInput {
  subject: string;
  body: string;
  fromDomain?: string;
}

export interface SpamCheckResult {
  riskScore: number;
  flags: string[];
}

// Words that commonly trigger spam filters
const SPAM_TRIGGER_WORDS = [
  'free',
  'winner',
  'urgent',
  'congratulations',
  'click here',
  'limited time',
  'act now',
  'guaranteed',
  'no risk',
  'make money',
  'earn money',
  'work from home',
  'cash bonus',
  'discount',
  'cheap',
  '100% free',
  'risk free',
  'special offer',
  'exclusive deal',
  'prize',
  'selected',
  'offer expires',
  'double your',
  'earn extra',
  'fast cash',
  'for free',
  'for just',
  'great offer',
  'incredible deal',
  'lowest price',
  'once in a lifetime',
  'unbelievable',
  'you have been chosen',
];

// Suspicious TLDs or patterns in from domain
const SUSPICIOUS_DOMAIN_PATTERNS = [
  /\d{4,}/, // many consecutive digits
  /-(mail|send|newsletter|blast)\./i,
  /\.xyz$/i,
  /\.top$/i,
  /\.click$/i,
  /\.loan$/i,
];

export function checkGmailSpamRisk(email: SpamCheckInput): SpamCheckResult {
  const flags: string[] = [];
  let score = 0;

  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase();
  const fullText = `${email.subject} ${email.body}`;

  // 1. Spam trigger words in subject (+10 per word, max 30)
  const subjectTriggers = SPAM_TRIGGER_WORDS.filter((w) => subjectLower.includes(w));
  if (subjectTriggers.length > 0) {
    const points = Math.min(30, subjectTriggers.length * 10);
    score += points;
    flags.push(`Spam trigger words in subject: ${subjectTriggers.slice(0, 3).join(', ')}`);
  }

  // 2. Spam trigger words in body (+5 per word, max 20)
  const bodyTriggers = SPAM_TRIGGER_WORDS.filter(
    (w) => bodyLower.includes(w) && !subjectTriggers.includes(w),
  );
  if (bodyTriggers.length > 0) {
    const points = Math.min(20, bodyTriggers.length * 5);
    score += points;
    flags.push(`Spam trigger words in body: ${bodyTriggers.slice(0, 3).join(', ')}`);
  }

  // 3. Excessive caps (>30% of alpha chars)
  const alphaChars = fullText.replace(/[^a-zA-Z]/g, '');
  const upperChars = fullText.replace(/[^A-Z]/g, '');
  if (alphaChars.length > 10) {
    const capsRatio = upperChars.length / alphaChars.length;
    if (capsRatio > 0.3) {
      score += 15;
      flags.push('Excessive capital letters (>30% of text is uppercase)');
    }
  }

  // 4. Too many links (more than 3)
  const linkMatches = email.body.match(/https?:\/\//gi) ?? [];
  if (linkMatches.length > 3) {
    score += 10;
    flags.push(`Too many links (${linkMatches.length} found, recommend ≤3)`);
  }

  // 5. Missing unsubscribe link
  const hasUnsubscribe =
    bodyLower.includes('unsubscribe') ||
    bodyLower.includes('opt out') ||
    bodyLower.includes('opt-out') ||
    bodyLower.includes('remove me');
  if (!hasUnsubscribe) {
    score += 10;
    flags.push('Missing unsubscribe link — required by CAN-SPAM/GDPR');
  }

  // 6. Suspicious from domain
  if (email.fromDomain) {
    const isSuspicious = SUSPICIOUS_DOMAIN_PATTERNS.some((p) => p.test(email.fromDomain!));
    if (isSuspicious) {
      score += 15;
      flags.push(`Suspicious sending domain: ${email.fromDomain}`);
    }
  }

  // 7. All-caps subject
  const subjectAlpha = email.subject.replace(/[^a-zA-Z]/g, '');
  if (subjectAlpha.length > 4 && subjectAlpha === subjectAlpha.toUpperCase()) {
    score += 10;
    flags.push('Subject line is all uppercase');
  }

  // 8. Excessive exclamation marks
  const exclamationCount = (fullText.match(/!/g) ?? []).length;
  if (exclamationCount > 3) {
    score += 5;
    flags.push(`Excessive exclamation marks (${exclamationCount} found)`);
  }

  return {
    riskScore: Math.min(100, score),
    flags,
  };
}
