# ig-engagement-claw

Opens conversations with people who just engaged with @varritech — new followers and
post-likers — by driving Cristiano's own logged-in Instagram session, a few at a time,
on a staggered schedule. Hands each opened thread to the sales claw
(`~/instagram-claw`) so the reply gets a stateful, selling response instead of a
cold restart.

This is the claw that does what the API cannot: **Meta exposes no follow or like
webhook**, so `~/instagram-claw` can only ever react to comments and inbound DMs.
Reading the followers and likers lists off the logged-in page sidesteps that entirely.
See `[[reference_ig_dm_comment_automation_policy]]` — that memory's "impossible"
verdict is scoped to API routes only.

## Why it's split in two

`mcp__claude-in-chrome__*` are Claude's tools, not a Node library, so the browser half
cannot be plain Node. The split:

| | owns |
|---|---|
| **Node** (`src/`) | who gets messaged, the cap, the window, link-stripping, the word cap, the ledger, the handoff |
| **Claude** (`runner-prompt.md`) | driving the logged-in session — and nothing else |

The agent is never trusted to decide who gets a DM or whether a send counts. It scrapes,
it asks `cli.js next`, it types what it's told, it confirms. That boundary is the whole
safety design.

## Flow

```
launchd (5x/day, staggered)
  -> claude -p runner-prompt.md
      1. read new followers + likers of last 3 posts        (READ ONLY)
      2. echo <scrape json> | node src/cli.js next          -> batch + openers
      3. type + send each, 40-90s apart, human-paced
      4. node src/cli.js commit <handle> <text> [igUserId]  -> ledger + handoff
```

## Safety rules, and where each one actually lives

| Rule | Enforced in |
|---|---|
| Never message the same person twice | `ledger.js` (persisted to `state/contacted.json`) |
| Cap per run | `select.js` |
| Business hours + weekdays only | `select.js` `isSendingWindow()` |
| No links in a cold opener | `opener.js` `stripLinks()` |
| Openers stay short | `opener.js` `capWords()` |
| A failed send is never marked contacted | `pipeline.js` — send, *then* record |
| Kill switch | `KILL_SWITCH=1` |

Rules live in code, not in the prompt, because prompt rules drift. This is the lesson
`~/instagram-claw` paid for twice (`DM_MAX_WORDS`, the em-dash stripper).

## Handoff to the sales claw — and its one open gap

The sales claw derives conversation stage from `ig_threads/{IGSID}`. If our opener isn't
in there, its drafter sees the reply as message #1 and re-introduces the founder to
someone we already opened — the exact stateless bug fixed in July, re-entered through a
different door.

**The gap:** that store is keyed by IGSID; the browser only sees `@handle`. When the agent
can read the numeric id off the page we write the real thread doc. When it can't, the
opener is parked in `ig_pending_openers/{handle}` — deliberately *not* a fake thread doc
under a key nothing looks up. Closing this properly needs a handle→IGSID resolver on the
sales-claw side. Until then, expect some threads to be picked up cold.

## Setup

```bash
export PATH="$HOME/.nvm/versions/node/v18.17.1/bin:$PATH"   # nvm's v22 has no npm here
npm install
npm test
```

`.env` / launchd environment:

| var | default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required for opener drafting |
| `GOOGLE_CLOUD_PROJECT` | — | unset = handoff disabled (warns loudly, still sends) |
| `HOURLY_CAP` | `6` | **start at 3** |
| `START_HOUR` / `END_HOUR` | `9` / `20` | local to `CLAW_TZ` |
| `CLAW_TZ` | `America/New_York` | |
| `KILL_SWITCH` | — | `1` = send nothing |

```bash
cp com.varritech.ig-engagement-claw.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.varritech.ig-engagement-claw.plist
```

Schedule is 5 staggered off-the-hour times, not `:00` hourly — a job that fires exactly
on the hour is itself a pattern. `launchd` needs the Mac awake.

## ⛔ Read before turning it on

This is cold outreach at cadence on a **personal logged-in session**. Instagram's
automation detection keys on action patterns and does not care whether they came from the
API or a browser — and the thing at risk is Cristiano's real account, not an app token.
The caps, the pacing jitter, the business-hours window and the stop-on-checkpoint rule are
what make it survivable, not decoration. Start at `HOURLY_CAP=3` and watch the first week.

If a run reports a checkpoint, an "Action Blocked" banner, or a challenge screen: stop,
leave it off for several days, and do not "just try again with a lower cap."

Related: `[[ig-dm-sales-claw]]` · `[[reference_instantdm_blocks_all_links_in_dms]]` ·
`[[feedback_no_cdp_use_claude_in_chrome]]`
