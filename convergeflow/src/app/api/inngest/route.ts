import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendEmailFn } from "@/lib/inngest/functions/send-email";
import { campaignStartFn, campaignPauseFn } from "@/lib/inngest/functions/campaign-executor";
import { warmupTickFn } from "@/lib/inngest/functions/warmup-tick";
import { bounceMonitorFn } from "@/lib/inngest/functions/bounce-monitor";
import { inboxSuspendFn } from "@/lib/inngest/functions/inbox-suspend";
import { scoreLeadsFn } from "@/lib/inngest/functions/score-leads";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendEmailFn,
    campaignStartFn,
    campaignPauseFn,
    warmupTickFn,
    bounceMonitorFn,
    inboxSuspendFn,
    scoreLeadsFn,
  ],
});
