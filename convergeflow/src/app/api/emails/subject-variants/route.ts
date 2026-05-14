/**
 * POST /api/emails/subject-variants
 *
 * Generates 3 A/B subject line variants using Ollama.
 * Falls back to template-based subjects if Ollama is unavailable.
 *
 * Request body: { emailBody, persona, leadData }
 * Response: { data: { variants: string[] } }
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ollamaClient } from "@/lib/ollama/client";
import { personaSchema } from "@/lib/schemas/campaign";
import { requireUser, parseAndValidate, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subjectVariantsSchema = z.object({
  emailBody: z.string().max(20_000),
  persona: personaSchema.optional(),
  leadData: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      industry: z.string().optional(),
    })
    .optional(),
});

const FALLBACK_SUBJECTS: Record<string, string[]> = {
  closer: [
    "Quick question about {company}",
    "{firstName}, worth a 15-min call?",
    "Your {industry} results — curious",
  ],
  neighbor: [
    "Hey {firstName} — quick intro",
    "Fellow {industry} connection",
    "Thought this might be useful for {company}",
  ],
  expert: [
    "The hidden cost in {industry} outreach",
    "{company}'s pipeline — an observation",
    "Data point on {industry} teams like yours",
  ],
  helper: [
    "Free resource for {company}",
    "Something useful for {firstName}",
    "A quick win for {industry} teams",
  ],
};

function buildFallbackSubjects(
  persona: string = "closer",
  leadData?: { firstName?: string; company?: string; industry?: string }
): string[] {
  const templates = FALLBACK_SUBJECTS[persona] ?? FALLBACK_SUBJECTS.closer;
  return templates.map((t) =>
    t
      .replace("{firstName}", leadData?.firstName ?? "there")
      .replace("{company}", leadData?.company ?? "your company")
      .replace("{industry}", leadData?.industry ?? "your industry")
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const parsed = await parseAndValidate(req, subjectVariantsSchema);
  if (parsed.response) return parsed.response;
  const { emailBody, persona, leadData } = parsed.data;

  logRequest("emails.subject-variants.POST", userId, { persona });

  const prompt = [
    "Generate exactly 3 subject line variants for this cold email.",
    "Make each subject line distinct: one curiosity-based, one benefit-based, one personalised.",
    "Return ONLY a JSON array of 3 strings. No explanation, no markdown.",
    "",
    `Email body:\n${emailBody.slice(0, 2000)}`,
  ].join("\n");

  try {
    const raw = await ollamaClient.chat([
      {
        role: "system",
        content: "You are a cold-email subject line specialist. Return only valid JSON arrays.",
      },
      { role: "user", content: prompt },
    ]);

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const variants = JSON.parse(match[0]) as unknown[];
      if (
        Array.isArray(variants) &&
        variants.length >= 1 &&
        variants.every((v) => typeof v === "string")
      ) {
        return NextResponse.json({ data: { variants: variants.slice(0, 3) } });
      }
    }

    // Fallback
    return NextResponse.json({
      data: { variants: buildFallbackSubjects(persona, leadData) },
    });
  } catch {
    // Ollama unavailable — fall back to templates
    return NextResponse.json({
      data: { variants: buildFallbackSubjects(persona, leadData) },
    });
  }
}
