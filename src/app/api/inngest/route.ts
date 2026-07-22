import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sendEmailFn } from '@/lib/inngest/functions/send-email';
import { campaignStartFn, campaignPauseFn } from '@/lib/inngest/functions/campaign-executor';
import { warmupTickFn } from '@/lib/inngest/functions/warmup-tick';
import { warmupReplyFn } from '@/lib/inngest/functions/warmup-reply';
import { dailyLeadRefreshFn } from '@/lib/inngest/functions/daily-lead-refresh';
import { dailyAutoSendFn } from '@/lib/inngest/functions/daily-auto-send';
import { classifyReplyFn } from '@/lib/inngest/functions/classify-reply';
import { feedbackLoopFn } from '@/lib/inngest/functions/feedback-loop';
import { generateSequencesFn } from '@/lib/inngest/functions/generate-sequences';
import { sequenceTickFn } from '@/lib/inngest/functions/sequence-tick';
import { campaignSchedulerFn } from '@/lib/inngest/functions/campaign-scheduler';
import { bounceMonitorFn } from '@/lib/inngest/functions/bounce-monitor';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendEmailFn,
    campaignStartFn,
    campaignPauseFn,
    warmupTickFn,
    warmupReplyFn,
    dailyLeadRefreshFn,
    dailyAutoSendFn,
    classifyReplyFn,
    feedbackLoopFn,
    generateSequencesFn,
    sequenceTickFn,
    campaignSchedulerFn,
    bounceMonitorFn,
  ],
});
