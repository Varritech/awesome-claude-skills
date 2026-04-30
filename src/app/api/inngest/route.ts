import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sendEmailFn } from '@/lib/inngest/functions/send-email';
import { campaignStartFn, campaignPauseFn } from '@/lib/inngest/functions/campaign-executor';
import { warmupTickFn } from '@/lib/inngest/functions/warmup-tick';
import { dailyLeadRefreshFn } from '@/lib/inngest/functions/daily-lead-refresh';
import { dailyAutoSendFn } from '@/lib/inngest/functions/daily-auto-send';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendEmailFn, campaignStartFn, campaignPauseFn, warmupTickFn, dailyLeadRefreshFn, dailyAutoSendFn],
});
