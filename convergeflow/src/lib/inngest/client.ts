import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "convergeflow",
  name: "ConvergeFlow",
});

// ─── Event type map ───────────────────────────────────────────────────────────

export type Events = {
  "email/send": {
    data: {
      emailId: string;
      inboxId: string;
      userId: string;
      testRecipient?: string; // override all sends to this address
    };
  };
  "campaign/start": {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  "campaign/pause": {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  "inbox/warmup-tick": {
    data: {
      inboxId: string;
      userId: string;
    };
  };
  "inbox/verify-smtp": {
    data: {
      inboxId: string;
      userId: string;
    };
  };
  "reply/received": {
    data: {
      emailId: string;
      replyBody: string;
      leadId?: string;
      userId: string;
    };
  };
};
