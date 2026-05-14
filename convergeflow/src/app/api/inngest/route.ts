import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendEmailFn } from "@/lib/inngest/functions/send-email";
import { campaignStartFn, campaignPauseFn } from "@/lib/inngest/functions/campaign-executor";
import { warmupTickFn } from "@/lib/inngest/functions/warmup-tick";
import { tokenRefreshFn } from "@/lib/inngest/functions/token-refresh";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendEmailFn, campaignStartFn, campaignPauseFn, warmupTickFn, tokenRefreshFn],
});
