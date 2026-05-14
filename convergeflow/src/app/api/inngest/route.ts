import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendEmailFn } from "@/lib/inngest/functions/send-email";
import { campaignStartFn, campaignPauseFn } from "@/lib/inngest/functions/campaign-executor";
import { warmupTickFn } from "@/lib/inngest/functions/warmup-tick";
import { sequenceTickFn } from "@/lib/inngest/functions/sequence-tick";
import { campaignSchedulerFn } from "@/lib/inngest/functions/campaign-scheduler";
import { bounceMonitorFn } from "@/lib/inngest/functions/bounce-monitor";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendEmailFn,
    campaignStartFn,
    campaignPauseFn,
    warmupTickFn,
    sequenceTickFn,
    campaignSchedulerFn,
    bounceMonitorFn,
  ],
});
