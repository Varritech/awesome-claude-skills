/**
 * Maps an AI-generated sequence (from `generateSequence`) to the
 * `SequenceStep` shape the SequenceEditor + sequence-tick use.
 *
 * The generator produces 5 A-variant emails + 2 B-variant (split-test) emails
 * for emails 1 & 2. The editor authors one canonical sequence, so we keep only
 * the A variants, ordered by email number, with `dayOffset` as the step delay.
 */

import type { GeneratedEmail } from "@/lib/ai/sequence-generator";
import type { SequenceStep } from "@/lib/schemas/sequence";

export function generatedEmailsToSteps(emails: GeneratedEmail[]): SequenceStep[] {
  return emails
    .filter((e) => e.variant === "A")
    .sort((a, b) => a.emailNumber - b.emailNumber)
    .map((e, i) => ({
      order: i,
      subject: e.subject,
      body: e.body,
      delayDays: e.dayOffset,
      condition: { type: "always" as const, afterDays: 0 },
    }));
}