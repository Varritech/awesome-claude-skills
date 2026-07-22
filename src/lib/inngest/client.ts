import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'convergeflow',
  name: 'ConvergeFlow',
});

// ─── Event type map ───────────────────────────────────────────────────────────

export type Events = {
  'email/send': {
    data: {
      emailId: string;
      inboxId: string;
      userId: string;
      testRecipient?: string;
    };
  };
  'email/reply-received': {
    data: {
      emailId: string;
      leadId: string;
      campaignId: string;
      replyText: string;
      userId: string;
    };
  };
  'email/positive-reply': {
    data: {
      emailId: string;
      leadId: string;
      campaignId: string;
      userId: string;
    };
  };
  'campaign/start': {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  'campaign/pause': {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  'campaign/generate-sequences': {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  'inbox/warmup-tick': {
    data: {
      inboxId: string;
      userId: string;
    };
  };
  'inbox/verify-smtp': {
    data: {
      inboxId: string;
      userId: string;
    };
  };
  'warmup/reply': {
    data: {
      from: string;
      toRecipient: string;
      subject: string;
      messageId: string;
    };
  };
};
