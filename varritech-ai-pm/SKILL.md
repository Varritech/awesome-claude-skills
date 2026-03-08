---
name: varritech-ai-pm
description: Varritech AI PM orchestrates project management across ClickUp, Notion, Slack, Gmail, Fathom, and GitHub. Handles sprint management, meeting-to-task pipelines, stakeholder updates, SOW tracking, and GitHub-to-task linkage. This skill should be used when the user asks for any project management operation including sprint reports, task status, meeting processing, SOW updates, or stakeholder notifications.
requires:
  mcp: [connect-apps]
---

# Varritech AI PM

Multi-agent project manager that bridges ClickUp (task execution), Notion (documentation & SOWs), Slack (team comms), Gmail (client comms), Fathom (meeting intelligence), and GitHub (dev activity).

## Deployment Modes

### Mode 1: OpenClaw (Production — Event-Driven)

The AI PM runs as an **OpenClaw agent**, receiving messages from Slack and WhatsApp through OpenClaw's built-in channel adapters. Cron jobs handle automated triggers (Fathom polling, overdue checks, weekly digests). Composio provides tool authentication for ClickUp, Notion, GitHub, and Gmail.

```
Slack/WhatsApp → OpenClaw Gateway → AI PM Agent → Composio Tools → ClickUp/Notion/GitHub/Gmail
```

**Key files:**
- `openclaw.json` — Channel config, agent bindings, cron jobs, Composio plugin
- `AGENTS.md` — Agent system prompt loaded by OpenClaw runtime
- `config.json` — Project-specific IDs, team roster, thresholds

### Mode 2: Claude Code (Development / Manual)

Invoke the skill manually in Claude Code for ad-hoc PM operations. Uses the existing Composio MCP connection (`connect-apps`). Useful for testing workflows before deploying to OpenClaw.

```
User → Claude Code → SKILL.md → Composio MCP → ClickUp/Notion/GitHub/Gmail
```

## Prerequisites

### Composio Connections (Both Modes)

Active Composio connections required:
- **clickup** — Task management surface
- **notion** — Documentation, SOW tracking, sprint reports, meeting logs
- **slack** — Team notifications and escalations (OpenClaw handles channel delivery; Composio handles API actions like search)
- **gmail** — Client-facing emails and stakeholder digests
- **github** — PR merge events and changelog
- **fathom** — Meeting transcripts and action items (API key via `FATHOM_API_KEY` env var)

Verify connections: Use `COMPOSIO_SEARCH_TOOLS` for each toolkit and confirm "Active" status. If not active, use `COMPOSIO_MANAGE_CONNECTIONS` to authenticate.

### OpenClaw Setup (Production Mode)

1. Install OpenClaw: `npm install -g openclaw` (requires Node.js 22+)
2. Create Slack app with Socket Mode enabled, get `xoxb-` bot token and `xapp-` app token
3. Configure WhatsApp via QR pairing on first launch
4. Copy `openclaw.json` to `~/.openclaw/openclaw.json` (or merge into existing config)
5. Copy workspace files (`AGENTS.md`, `config.json`, `agents/`, `references/`) to `~/.openclaw/workspaces/varritech-pm/`
6. Enable Composio plugin: set `plugins.composio.enabled: true` in `openclaw.json`
7. Start gateway: `openclaw start`

### Data Setup (Both Modes)

1. Create 6 Notion databases using schemas in `references/notion-database-schemas.md` (or run `scripts/setup-notion-databases.py`)
2. Copy database IDs into `config.json` → `workspace.notion`
3. Map ClickUp workspace: resolve `team_id`, `space_id`, `default_list_id` via `CLICKUP_GET_AUTHORIZED_TEAMS_WORKSPACES` and `CLICKUP_GET_SPACES`
4. Populate `config.json` → `team[]` with each member's cross-platform IDs
5. Configure Slack channels in `config.json` → `channels`
6. Add projects to `config.json` → `projects` with client details and SOW page IDs
7. Set `FATHOM_API_KEY` environment variable
8. Test each workflow with a dry run (see Verification section)

## Agent Overview

| Agent | File | Responsibility |
|-------|------|---------------|
| **PM Orchestrator** | `agents/pm-orchestrator.md` | Classifies events/commands and dispatches to specialist agents |
| **Meeting Processor** | `agents/meeting-processor.md` | Fathom → action items → ClickUp tasks → Notion meeting log |
| **Sprint Manager** | `agents/sprint-manager.md` | Sprint lifecycle, velocity tracking, overdue detection |
| **Stakeholder Communicator** | `agents/stakeholder-communicator.md` | Slack notifications + Gmail emails (always called by other agents) |
| **SOW Tracker** | `agents/sow-tracker.md` | Notion SOW milestone tracking ↔ ClickUp task completion |
| **DevOps Linker** | `agents/devops-linker.md` | GitHub PR → ClickUp task updates → Notion changelog |

## Manual Commands

| Command | What Happens |
|---------|-------------|
| "Process last meeting" | Meeting Processor fetches latest Fathom recording, creates tasks, logs to Notion, posts Slack summary |
| "Sprint report" | Sprint Manager aggregates current sprint data, creates Notion report page, posts Slack summary |
| "What's overdue?" | Sprint Manager queries ClickUp for overdue tasks, shows escalation levels |
| "Update SOW for [project]" | SOW Tracker recalculates milestone progress from linked ClickUp tasks |
| "Send status update" | Stakeholder Communicator posts sprint summary to Slack and/or emails stakeholders |
| "Create new sprint" | Sprint Manager creates next sprint folder in ClickUp, moves carry-over tasks |
| "SOW health" | SOW Tracker shows all projects' milestone status (on track / at risk / behind) |
| "Link PR #N to CU-xxx" | DevOps Linker manually associates a PR with a ClickUp task |

## Event Routing

### OpenClaw Cron Triggers (Production)

| Cron Schedule | What It Does | Delivery Channel |
|---------------|-------------|-----------------|
| `*/5 * * * *` (every 5 min) | Poll Fathom for new meetings, process if found | `slack:project-updates` |
| `0 9 * * 1-5` (9 AM weekdays) | Check for overdue tasks, send escalations | `slack:pm-alerts` |
| `0 17 * * 5` (Friday 5 PM) | Generate weekly digest, email stakeholders | `slack:project-updates` |

### OpenClaw Channel Triggers (Production)

Any message sent to the AI PM via Slack or WhatsApp is classified and routed:

| Message Pattern | Agent Chain |
|----------------|-------------|
| "process meeting", "check fathom" | Meeting Processor → response in originating channel |
| "sprint report", "sprint status" | Sprint Manager → response in originating channel |
| "what's overdue" | Sprint Manager → response + escalation alerts |
| "update SOW for X" | SOW Tracker → response in originating channel |
| "create sprint" | Sprint Manager → response in originating channel |
| "link PR #N to CU-xxx" | DevOps Linker → response in originating channel |

### Event Chains

| Event | Trigger | Agent Chain |
|-------|---------|-------------|
| New Fathom meeting | Cron poll (5 min) or manual | Meeting Processor → Stakeholder Communicator |
| Task overdue | Cron (daily 9 AM) or manual | Sprint Manager → Stakeholder Communicator |
| PR merged | Composio webhook or manual | DevOps Linker → (if SOW-linked) SOW Tracker → Stakeholder Communicator |
| Sprint ending | Cron / manual | Sprint Manager → Stakeholder Communicator |
| SOW milestone complete | Detected by SOW Tracker | SOW Tracker → Stakeholder Communicator |

## Cross-Reference Convention

Tools are linked through embedded IDs:

- **ClickUp → Fathom**: Task tag `fathom:<recording_id>`
- **ClickUp → SOW**: Task tag `sow:<notion_page_id>`
- **ClickUp → GitHub**: Task description contains PR URL
- **GitHub → ClickUp**: PR title/body contains `CU-<task_id>`
- **Notion Meeting Log → ClickUp**: "ClickUp Task IDs" property
- **Notion SOW → ClickUp**: "Linked Tasks" property
- **Notion Changelog → GitHub**: "PR URL" property

## Configuration

All settings live in `config.json` at the skill root. Key sections:

- `workspace.clickup` — IDs and status names (case-sensitive)
- `workspace.notion` — Database IDs for all 6 databases
- `workspace.github` — Repos to monitor, task ID regex
- `team[]` — Team roster with cross-platform IDs
- `channels` — Slack channel names for each notification type
- `sprints` — Duration, story points, velocity window
- `escalation` — Overdue thresholds (warning/escalation/critical days)
- `projects{}` — Per-project client info, SOW page, ClickUp space, Slack channel
- `fathom` — Poll interval, default priority and due days for new tasks

## Orchestrator Instructions

When invoked, the PM Orchestrator should:

1. **Load config** — Read `config.json` from the skill root
2. **Classify intent** — Determine if this is a manual command or event trigger
3. **Route to specialist** — Use the Task tool to invoke the appropriate agent(s)
4. **Chain if needed** — Many workflows end with Stakeholder Communicator; invoke it with the output payload from the prior agent
5. **Report back** — Summarize what was done and any issues encountered

For detailed agent instructions, read the relevant file from `agents/` directory.

## OpenClaw Architecture

### Message Flow

```
1. INGESTION     — Slack/WhatsApp adapter receives message
2. ACCESS CTRL   — Validates sender against allowlist/pairing policy
3. ROUTING       — resolveAgentRoute() → varritech-pm agent
4. CONTEXT       — Loads AGENTS.md system prompt + session history
5. CLASSIFICATION — Agent classifies intent (meeting/sprint/SOW/overdue/PR)
6. TOOL EXECUTION — Composio plugin executes ClickUp/Notion/GitHub/Gmail tools
7. RESPONSE      — Formatted reply sent back through originating channel
```

### Channel Behavior

**Slack:**
- DMs: Open to all workspace members (`dmPolicy: allowlist`, `allowFrom: ["*"]`)
- Channels: Mention-gated (`requireMention: true`) — bot must be @mentioned
- Threading: Replies stay in threads when thread bindings are active
- Streaming: Partial mode (preview text replaced as response generates)
- Chunk limit: 4000 characters (auto-split for longer messages)

**WhatsApp:**
- DMs: Pairing mode — new contacts get one-time approval code
- Groups: Mention-gated
- Plain text formatting only (no Slack markdown)

### Session Scoping

Sessions are scoped `per-channel-peer` — each person gets their own conversation context per channel. A Slack DM and a WhatsApp message from the same person are separate sessions.

Thread bindings are enabled with 24-hour idle timeout — conversations in Slack threads maintain context for 24 hours.

### Composio Integration

OpenClaw's Composio plugin (`plugins.composio.enabled: true`) handles tool authentication:
- OAuth flows for ClickUp, Notion, GitHub, Gmail, Slack
- API key management for Fathom
- Tool execution routing through Composio's backend
- The agent uses Composio tool slugs directly (`CLICKUP_CREATE_TASK`, `NOTION_INSERT_ROW_DATABASE`, etc.)

### File Layout for OpenClaw Deployment

```
~/.openclaw/
├── openclaw.json              ← Gateway config (channels, bindings, cron, plugins)
└── workspaces/
    └── varritech-pm/          ← Agent workspace
        ├── AGENTS.md           ← System prompt
        ├── config.json         ← Project config (IDs, roster, thresholds)
        ├── agents/             ← Specialist agent instructions (loaded on demand)
        │   ├── meeting-processor.md
        │   ├── sprint-manager.md
        │   ├── stakeholder-communicator.md
        │   ├── sow-tracker.md
        │   └── devops-linker.md
        └── references/         ← Templates and schemas
            ├── notion-database-schemas.md
            ├── workflow-templates.md
            └── setup-guide.md
```
