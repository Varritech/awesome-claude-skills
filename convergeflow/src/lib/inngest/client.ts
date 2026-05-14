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
  "email/bounced": {
    data: {
      emailId: string;
      campaignId: string;
      userId: string;
      reason?: string;
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
  "sequence/tick": {
    data: {
      campaignId: string;
      userId: string;
    };
  };
  "scheduler/run": {
    data: Record<string, never>;
  };
};
