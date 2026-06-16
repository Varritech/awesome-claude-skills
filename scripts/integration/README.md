# Integration tests — real send pipeline

These scripts hit a real Vercel deployment, a real Firestore, and a real SMTP
server. **No mocks.** They are intentionally not part of `vitest` because they
require live credentials and a deployed app.

## Setup

1. Copy `.env.integration.example` to `.env.integration.local` (gitignored) and
   fill in:

   - `INTEGRATION_BASE_URL` — preview or prod URL (e.g. `https://convergeflow-push.vercel.app`)
   - `INTEGRATION_CLERK_TOKEN` — a Clerk session JWT for a test user. Grab from
     a logged-in browser via DevTools → Application → Cookies → `__session`.
   - `INTEGRATION_USER_ID` — the matching Clerk user id (e.g. `user_...`)
   - `INTEGRATION_TO_EMAIL` — where the test message gets delivered. Use an
     inbox you can check (Gmail with `+convergeflow-int` suffix is fine).
   - `FIREBASE_ADMIN_*` — same values as production env.
   - Optional `INTEGRATION_SMTP_*` — your own SMTP creds. **If unset, the
     script automatically creates a throwaway Ethereal Email account**, so you
     can run end-to-end without configuring anything.

2. Install deps if not already present:
   ```
   npm install
   ```

## Run

```bash
# Own-SMTP path: provisions an Ethereal account, connects, sends, asserts.
node scripts/integration/send-real-email.mjs
```

Optional cleanup of the test inbox at the end:
```bash
INTEGRATION_CLEANUP=1 node scripts/integration/send-real-email.mjs
```

## What it asserts

1. `POST /api/inboxes` accepts user-supplied SMTP creds and returns 201
2. Firestore `inboxes/{id}` has `smtpHost`, `smtpPort`, `smtpUser`,
   `smtpPasswordEncrypted`, `status=warming`, `warmupStartDate`
3. A queued email with `scheduledFor` in the past gets picked up by
   `/api/cron/send-scheduled-emails` and dispatched
4. Firestore `emails/{id}.status` transitions from `queued` → `sent`
5. The remote SMTP server actually accepted the message (Ethereal preview
   URL is printed; for real SMTP, the recipient address is verified by
   inbox check)

## Resend path (BYO domain)

A second script `send-via-resend.mjs` will cover:
- Adding a BYO domain through `/api/domains` (calls Resend `domains.create`)
- Polling `/api/domains/[id]/verify` until SPF/DKIM/DMARC turn green
- Connecting a sending inbox (Gmail OAuth or own SMTP) via `/api/inboxes`
- Sending a real email and asserting delivery via the Resend webhook
  `/api/webhooks/resend` (event `email.delivered`)

Requires `RESEND_API_KEY` (Full Access scope) and `RESEND_WEBHOOK_SECRET`
in the local env or `.env.test`.
