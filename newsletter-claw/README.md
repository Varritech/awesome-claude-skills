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
| `TRACK_BASE` | base URL for click-tracking redirect (usually the claw's own public URL). CTA/PS links wrap through `${TRACK_BASE}/c?e=&u=&n=` → logs to ladk `email_clicks` → 302 to dest. Own-CRM click attribution (HubSpot open-pixel only works for HubSpot-sent email, so we track clicks instead). Unset = links sent raw (no tracking). |

## Run

```bash
npm test            # 18 tests, node --test
npm start           # :8080 — /health /run /approve /preview
```

Deploy: Cloud Run (varritech-dev) + Cloud Scheduler weekly hit on `/run`, same pattern as budget-claw.
