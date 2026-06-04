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

## Mailforge path (future)

A second script `send-via-mailforge.mjs` will cover:
- Buying a Mailforge domain through `/api/domains`
- Waiting for DNS verification (`/api/domains/[id]/verify` returning all-green)
- Provisioning a mailbox via `/api/inboxes` with that `domainId`
- Sending and verifying delivery

That depends on PR #111 (auth header fix) being merged and a Mailforge domain
being purchased. Once both are in place, the script mirrors the same shape as
`send-real-email.mjs`.
