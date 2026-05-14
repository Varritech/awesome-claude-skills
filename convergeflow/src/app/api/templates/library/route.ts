/**
 * GET /api/templates/library
 *
 * Returns 10 built-in email templates (hardcoded, persona-tagged).
 * 2 templates per persona (closer/neighbor/expert/helper) + 2 bonus.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, logRequest } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface LibraryTemplate {
  id: string;
  name: string;
  persona: "closer" | "neighbor" | "expert" | "helper";
  subject: string;
  body: string;
  tags: string[];
  isLibrary: true;
}

export const LIBRARY_TEMPLATES: LibraryTemplate[] = [
  // ── Closer ──────────────────────────────────────────────────────────────────
  {
    id: "lib_closer_1",
    name: "Direct Outcome Closer",
    persona: "closer",
    subject: "Quick question about {{company}}",
    body: `Hi {{firstName}},

I help {{industry}} companies add 20-30% more booked calls without changing their existing stack.

{{company}} caught my attention — I think there's a specific opportunity worth 15 minutes.

Are you open to a quick call this week?

{{senderName}}
{{senderCompany}}

To unsubscribe, reply "unsubscribe".`,
    tags: ["direct", "outcome", "cold-outreach"],
    isLibrary: true,
  },
  {
    id: "lib_closer_2",
    name: "Revenue Impact Closer",
    persona: "closer",
    subject: "{{firstName}}, worth a 15-min call?",
    body: `Hi {{firstName}},

Most {{industry}} teams I talk to are leaving revenue on the table with their current outreach approach.

I built a system that fixes the three biggest leaks. Takes 15 minutes to show you.

Would {{currentDate}} work, or do you have a better slot?

{{senderName}}
{{senderCompany}}

Unsubscribe: reply with "unsubscribe".`,
    tags: ["revenue", "urgency", "cold-outreach"],
    isLibrary: true,
  },

  // ── Neighbor ────────────────────────────────────────────────────────────────
  {
    id: "lib_neighbor_1",
    name: "Friendly Intro Neighbor",
    persona: "neighbor",
    subject: "Hey {{firstName}} — quick intro",
    body: `Hey {{firstName}},

Came across {{company}} and thought I'd say hi. I work with {{industry}} teams on improving their outreach and I genuinely think there's a fit here.

No pitch, just a quick chat to see if it makes sense. 10 minutes?

{{senderName}} at {{senderCompany}}

P.S. If this isn't a good fit, just let me know — no hard feelings!

To opt out, reply "unsubscribe".`,
    tags: ["friendly", "casual", "intro"],
    isLibrary: true,
  },
  {
    id: "lib_neighbor_2",
    name: "Shared Context Neighbor",
    persona: "neighbor",
    subject: "Fellow {{industry}} connection",
    body: `Hi {{firstName}},

I noticed we're both in the {{industry}} space. Small world.

I've been helping teams like yours at {{company}} with a specific problem in outbound — and the results have been pretty solid.

Would love to share what we've been seeing if you're open to a brief call.

Cheers,
{{senderName}}
{{senderCompany}}

Unsubscribe anytime: reply "unsubscribe".`,
    tags: ["shared-context", "network", "casual"],
    isLibrary: true,
  },

  // ── Expert ───────────────────────────────────────────────────────────────────
  {
    id: "lib_expert_1",
    name: "Industry Insight Expert",
    persona: "expert",
    subject: "The hidden cost in {{industry}} outreach",
    body: `Hi {{firstName}},

Most {{industry}} teams spend 40% of their outreach budget on leads that will never convert. The signal is in the reply patterns — but most tools don't surface it.

We built a system that identifies these patterns early so you stop wasting cycles on dead-end prospects.

Worth a 15-minute walkthrough?

{{senderName}}
{{senderCompany}}

To unsubscribe, reply "unsubscribe".`,
    tags: ["insight", "data", "authority"],
    isLibrary: true,
  },
  {
    id: "lib_expert_2",
    name: "Data-Led Expert",
    persona: "expert",
    subject: "{{company}}'s pipeline — an observation",
    body: `Hi {{firstName}},

I've been tracking how {{industry}} companies structure their outbound and I noticed a pattern at {{company}} level that typically costs 20% of potential pipeline.

Happy to share the analysis and what's worked for similar teams — takes about 15 minutes.

Interested?

{{senderName}}
{{senderCompany}}

Unsubscribe: reply "unsubscribe".`,
    tags: ["data", "pipeline", "expert"],
    isLibrary: true,
  },

  // ── Helper ───────────────────────────────────────────────────────────────────
  {
    id: "lib_helper_1",
    name: "Free Resource Helper",
    persona: "helper",
    subject: "Free resource for {{company}}",
    body: `Hi {{firstName}},

I put together a short guide on the outreach mistakes most {{industry}} teams make in their first 90 days. No catch — just thought it might be useful for {{company}}.

Happy to send it over. Want me to drop it in?

{{senderName}}
{{senderCompany}}

Unsubscribe: reply "unsubscribe".`,
    tags: ["value-first", "resource", "helpful"],
    isLibrary: true,
  },
  {
    id: "lib_helper_2",
    name: "Quick Win Helper",
    persona: "helper",
    subject: "A quick win for {{industry}} teams",
    body: `Hi {{firstName}},

I've been helping {{industry}} teams run one simple experiment that usually adds 2-3 booked calls per week. No tool changes required.

I can walk you through it in 10 minutes — totally free.

Would that be worth your time?

{{senderName}}
{{senderCompany}}

To opt out, reply "unsubscribe".`,
    tags: ["quick-win", "value-first", "low-ask"],
    isLibrary: true,
  },

  // ── Bonus ─────────────────────────────────────────────────────────────────────
  {
    id: "lib_bonus_1",
    name: "Social Proof Opener",
    persona: "closer",
    subject: "How [Similar Co] added 30% more meetings",
    body: `Hi {{firstName}},

A {{industry}} company similar to {{company}} used our system to go from 5 to 9 booked calls per week in 6 weeks. Same size team, same budget.

I think we can do something similar for you. 15 minutes to walk through how?

{{senderName}}
{{senderCompany}}

Unsubscribe: reply "unsubscribe".`,
    tags: ["social-proof", "case-study", "results"],
    isLibrary: true,
  },
  {
    id: "lib_bonus_2",
    name: "Curiosity Gap",
    persona: "expert",
    subject: "One thing most {{industry}} teams miss",
    body: `Hi {{firstName}},

There's one thing almost every {{industry}} team overlooks in their outbound that costs them 30-40% of their replies.

It's not copy, not targeting, not timing. It's something most people dismiss as minor.

I can show you in 10 minutes. Open to it?

{{senderName}}
{{senderCompany}}

Unsubscribe: reply "unsubscribe".`,
    tags: ["curiosity", "hook", "expert"],
    isLibrary: true,
  },
];

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { userId } = auth;

  const { searchParams } = new URL(req.url);
  const persona = searchParams.get("persona") ?? undefined;

  logRequest("templates.library.GET", userId, { persona });

  const data = persona ? LIBRARY_TEMPLATES.filter((t) => t.persona === persona) : LIBRARY_TEMPLATES;

  return NextResponse.json({ data });
}
