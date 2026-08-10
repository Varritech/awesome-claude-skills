# Newsletter Claw — "Varritech Minute"

Always-on agent that writes the Varritech leads newsletter in the exact **Mozi Minute** format (Alex Hormozi / acquisition.com), grounded in real Varritech work, and only sends after Cristiano clicks approve.

## Flow

```
Cloud Scheduler (weekly)
  → GET /run
      1. pickTopic(outline.yaml, history)        — rotates 24 ideas, never repeats recent
      2. loadRecentWork()                        — litestream-restores claude-mem replica from
                                                   gs://varritech-dev-claude-mem (READ ONLY,
                                                   single-writer rule respected), pulls last
                                                   7 days of observations as proof assets
      3. research(topic)                         — runs the /research SKILL via Claude Code
                                                   headless (`claude -p`, skill bundled in image);
                                                   NEVER the raw web_search tool; degrades to ''
      4. generateDraft()                         — Claude writes Mozi-format issue; every claim
                                                   must trace to a proof asset (no invented numbers)
      5. email DRAFT to christian@varritech.com  — full preview + green "Approve & send" button
  → Cristiano clicks approve link
  → GET /approve?id=&token=                      — timing-safe, single-use token
      → sends issue to every lead via Composio GMAIL
      → appends topic to rotation history
```

## Audience (loadLeads — live-verified 34 unique on 2026-07-03)

Union of every email that came in through Claude Code Skills:
1. `skill_downloads.email` — Skills Library purchasers (vds-marketing Supabase)
2. `community_invites.email` — founders community requests (same DB)
3. Gmail `subject:"New playbook lead"` internal notifications via Composio
   GMAIL_FETCH_EMAILS — guide downloads (the playbook-lead route only emails
   the team, never persists to DB; bodies are HTML → parser strips tags)

Deduped case-insensitively; internal/test addresses excluded via `EXCLUDE_EMAILS`.

## Editions (2026-08-10)

An **edition** = a named newsletter with its own audience and masthead. `audiences.js` owns the map.

| edition | audience | subject masthead |
|---|---|---|
| `varritech-minute` (default) | `loadLeads()` — the ~178-lead union | `Varritech Minute: <hook>` |
| `scalewright-inner-circle` | static hand-picked list of 6 (in `audiences.js`) | `Scalewright Inner Circle: <hook>` |

```bash
GET /run                                     # default broadcast
GET /run?edition=scalewright-inner-circle    # Inner Circle issue
```

The Inner Circle list is **deliberately static**, not a query — these are people Cristiano
named one at a time (2026-08-10). A query that "helpfully" widened it would turn a private
note into a broadcast.

Three safety properties, each covered by a test:

1. **The audience is bound to the draft at `/run`.** `/approve` reads `draft.edition` back
   rather than re-deriving a list, so the audience a draft was written for is the only one
   it can ever be sent to.
2. **An unknown edition throws — no fallback.** `loadAudience('scaleright-…')` (the
   `ScaleRight`/`Scalewright` spelling trap) is a 400 at `/run`, never a silent 178-person send.
3. **Tracking is namespaced per edition.** `n=` becomes `scalewright-inner-circle:<topic>`
   for non-default editions; the default stays the bare topic name so existing
   `email_clicks`/`email_opens` history remains one continuous series.

⛔ Brand spelling is **`Scalewright`** — one word, lowercase w, across Method / Installation /
Managed / Circle. The ad files named `scaleright-*` are the outlier, not the brand.

## Format (locked, from Mozi Minute teardown)

Subject `Varritech Minute: <hook>` · plain white 600px column · Arial 16px black · one sentence per paragraph · cold-open story with real numbers · numbered "here's what we did" steps · exactly one soft CTA · sign-off + `- Cristiano` · PS link · unsubscribe + disclaimer footer.

## Env

| var | purpose |
|---|---|
| `ANTHROPIC_API_KEY` | draft generation + Claude Code CLI for /research skill — use the funded key from `adfactory-claw/.env` (verified 2026-07-03), NOT the daryl-bot key (org 84b4e0cf, $0 credit) |
| `ANTHROPIC_MODEL` | default `claude-sonnet-5` |
| `COMPOSIO_API_KEY` / `COMPOSIO_USER_ID` | Gmail send as christian@varritech.com |
| `CLAUDE_MEM_REPLICA_URL` | `gcs://varritech-dev-claude-mem/claude-mem.db` (prod) |
| `CLAUDE_MEM_DB_PATH` | local dev: path to claude-mem.db (copied, never opened live) |
| `STATE_BUCKET` | GCS bucket for approvals + topic history (dev fallback: `./state/*.json`) |
| `BASE_URL` | public Cloud Run URL (approve links) |
| `LEADS_SUPABASE_URL` | `https://ladkwxrmoouycdekvgiy.supabase.co` (vds-marketing Supabase, main project) |
| `LEADS_SUPABASE_SERVICE_KEY` | legacy service_role key from Supabase dashboard (Vercel's `SUPABASE_SERVICE_ROLE_KEY` is EMPTY — do not trust it) |
| `EXCLUDE_EMAILS` | default excludes christian@, jake@, varriale737@ (test lead) |
| `LEADS_JSON` | manual override list (testing) |
| `APPROVER_EMAIL` | default christian@varritech.com |
| `TRACK_BASE` | base URL for click-tracking redirect (usually the claw's own public URL). CTA/PS links wrap through `${TRACK_BASE}/c?e=&u=&n=` → logs to ladk `email_clicks` → texts a click notification → 302 to dest. Unset = links sent raw (no tracking). |
| `QUO_API_KEY` | OpenPhone/Quo raw API key — sends the click-notification SMS. Unset = SMS silently skipped (logged), click tracking/redirect still works. |
| `QUO_FROM_NUMBER` | sending number, default `+13658250303` |
| `NOTIFY_PHONE_NUMBER` | E.164 number to text on every link click, e.g. `+16474102820` |

## Open + click tracking (2026-07-14)

Every sent issue embeds a unique per-recipient tracking pixel (`<img src="{baseUrl}/o?e=&n=" />`)
that logs to `email_opens` on load, and every CTA/PS link is wrapped through `/c?e=&u=&n=`
which logs to `email_clicks` **and** texts `NOTIFY_PHONE_NUMBER` (via `sms.js` / Quo)
before 302-redirecting to the real destination. Neither the DB log nor the SMS ever
blocks the redirect/pixel — both are best-effort, wrapped in try/catch. Full recipe
(pixel HTML, click-wrap, Supabase schema, SMS payload) is codified as a reusable skill:
see `~/.claude/skills/custom-link-tracker/SKILL.md`.

## Founder 1:1 tracked emails (2026-07-24)

`founder-email.js` reuses the same `/c` and `/o` endpoints for **one-to-one founder emails**,
not just broadcasts. The difference is where tracking gets injected: the newsletter injects at
send time inside `/approve`, but founder emails are sent by hand from Gmail after Cristiano
reads them, so tracking is baked into the **draft body** and goes live when he hits send.

```js
import { buildDraftPayload } from './founder-email.js';
const payload = buildDraftPayload({
  to: 'prospect@example.com',
  subject: '...',
  text: plainTextBody,               // authored as plain text
  campaign: 'founder:martin-russo',  // "founder:" prefix changes the SMS copy
  baseUrl: process.env.TRACK_BASE,
});
// -> exactly the Composio GMAIL_CREATE_EMAIL_DRAFT / GMAIL_UPDATE_DRAFT arguments
```

Renders plain-LOOKING HTML: real URL stays the visible link text, prose is escaped,
`\n` becomes `<br />`. Omitting `baseUrl` or `to` disables tracking entirely — that is
the deliberate cold-outreach path, since a pixel plus redirect links is more
spam-triggering than raw text and cold first-touch should stay plain.

`sms.js` exports pure `clickText`/`openText` so the copy is testable without a network.
A `founder:`-prefixed campaign texts `Martin Russo clicked varritech.com/prepare`
(named, path included, because in a 1:1 *which* link is the entire signal) instead of
`lead@acme.com clicked varritech.com in Varritech Minute`.

Full recipe + tradeoffs: `~/.claude/skills/tracked-founder-email/SKILL.md`.

## Run

```bash
npm test            # node --test test/
npm start           # :8080 — /health /run /approve /preview /c /o
```

Node 20+ required for `node --test` (`nvm use 20`; the machine default is v14).

Deploy: Cloud Run (varritech-dev) + Cloud Scheduler weekly hit on `/run`, same pattern as budget-claw.

**Public service URL** (this is what `BASE_URL` and `TRACK_BASE` point at):
`https://newsletter-claw-xeuwgcgbxa-uc.a.run.app`
