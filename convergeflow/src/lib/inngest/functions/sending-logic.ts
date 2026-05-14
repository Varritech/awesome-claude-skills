/**
 * Pure business logic for the sending engine.
 *
 * All functions are pure (no I/O) so they can be unit-tested without mocking.
 * Inngest functions import these and wrap them with step.run().
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepCondition {
  type: "no_reply" | "no_open" | "always";
  afterDays: number;
}

export interface SequenceStep {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
  condition?: StepCondition;
}

export interface AbVariant {
  label: string;
  subjectSuffix: string;
  bodySuffix: string;
  weight: number;
}

// ─── Sequence condition evaluation ───────────────────────────────────────────

export interface ShouldSendParams {
  condition: StepCondition;
  step: Pick<SequenceStep, "order" | "subject" | "body" | "delayDays">;
  leadStatus: string;
  lastStepSentDaysAgo: number;
}

/**
 * Determines whether the next sequence step should be sent to a lead.
 *
 * Rules:
 * - afterDays must have elapsed since the previous step was sent
 * - 'always': send regardless of lead engagement state
 * - 'no_reply': only send if lead has not replied
 * - 'no_open': only send if lead has not opened (nor replied)
 */
export function shouldSendNextStep({
  condition,
  leadStatus,
  lastStepSentDaysAgo,
}: ShouldSendParams): boolean {
  // Gate: not enough time has passed
  if (lastStepSentDaysAgo < condition.afterDays) {
    return false;
  }

  switch (condition.type) {
    case "always":
      return true;

    case "no_reply":
      return leadStatus !== "replied";

    case "no_open":
      // 'opened' or 'replied' both mean the lead opened the email
      return leadStatus !== "opened" && leadStatus !== "replied";

    default:
      return false;
  }
}

// ─── Multi-inbox rotation ─────────────────────────────────────────────────────

/**
 * Returns the inbox ID to use for the email at position `emailIndex`,
 * rotating round-robin through the available inbox IDs.
 */
export function pickRotationInbox(inboxIds: string[], emailIndex: number): string {
  if (inboxIds.length === 0) {
    throw new Error("pickRotationInbox: inboxIds must not be empty");
  }
  return inboxIds[emailIndex % inboxIds.length]!;
}

// ─── Bounce rate calculation ──────────────────────────────────────────────────

/**
 * Returns bounce rate as a percentage (0–100).
 * Returns 0 if no emails have been sent.
 */
export function calculateBounceRate({ sent, bounced }: { sent: number; bounced: number }): number {
  if (sent === 0) return 0;
  return (bounced / sent) * 100;
}

// ─── A/B variant assignment ───────────────────────────────────────────────────

/**
 * Assigns an A/B variant label based on weighted random selection.
 *
 * @param variants  Non-empty array of variants with `weight` (sum doesn't need to be 100).
 * @param random    A value in [0, 1) — pass Math.random() in production, or a fixed value for tests.
 * @returns         The `label` of the selected variant.
 */
export function assignAbVariant(variants: AbVariant[], random: number): string {
  if (variants.length === 0) {
    throw new Error("assignAbVariant: variants must not be empty");
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let cursor = 0;

  for (const variant of variants) {
    cursor += variant.weight / totalWeight;
    if (random < cursor) {
      return variant.label;
    }
  }

  // Fallback: return last variant (handles floating-point edge at exactly 1.0)
  return variants[variants.length - 1]!.label;
}
