# Varritech AI PM — Setup Guide

Follow these steps to configure the AI PM system for first use.

---

## Step 1: Verify Composio Connections

Ensure active connections exist for all required toolkits:

```
clickup    — Task management
notion     — Documentation and databases
slack      — Team notifications
gmail      — Client emails
github     — PR tracking
```

**How to verify:**
1. Use `COMPOSIO_SEARCH_TOOLS` for each toolkit
2. Check the connection status in the response
3. If not active, run `COMPOSIO_MANAGE_CONNECTIONS` with the toolkit name
4. Click the returned auth link to authenticate

**Optional connections:**
- `googlecalendar` — Sprint ceremony scheduling
- `fathom` — Uses API key directly (set `FATHOM_API_KEY` env var)

---

## Step 2: Create Notion Databases

Create 6 databases in Notion following the schemas in `references/notion-database-schemas.md`.

**Option A: Automated setup**
Run `scripts/setup-notion-databases.py` — this creates all databases under a specified Notion parent page.

**Option B: Manual setup**
1. Create a Notion page titled "AI PM System" (or similar)
2. Inside it, create 6 inline databases:
   - Meeting Log
   - Sprint Reports
   - SOW Tracker
   - Changelog
   - Comms Log
   - PM State
3. Add properties exactly as documented in the schemas reference
4. For the PM State database, add 4 initial rows:
   - `last_fathom_recording_id` (empty value)
   - `current_sprint_number` (value: "1")
   - `current_sprint_list_id` (fill after Step 3)
   - `current_sprint_end_date` (fill after Step 3)

---

## Step 3: Configure ClickUp Workspace

Map your ClickUp workspace hierarchy to get the required IDs.

1. Get workspace (team) ID:
   - `CLICKUP_GET_AUTHORIZED_TEAMS_WORKSPACES`
   - Note the `id` field of your workspace

2. Get space ID:
   - `CLICKUP_GET_SPACES` with `team_id`
   - Find the space for your projects, note its `id`

3. Get or create the default task list:
   - `CLICKUP_GET_LISTS` with `folder_id` or `space_id`
   - Or create: `CLICKUP_CREATE_LIST` in the desired location
   - Note the list `id`

4. Verify status names:
   - Status names in ClickUp are **case-sensitive** and **list-specific**
   - Check what statuses exist on your list and update `config.json` → `workspace.clickup.statuses` to match exactly

5. Get team member user IDs:
   - `CLICKUP_GET_WORKSPACE_SEATS` with `team_id`
   - Note each member's `id` for the team roster

---

## Step 4: Populate config.json

Fill in the placeholder values in `config.json`:

### workspace.clickup
```json
{
  "team_id": "<from Step 3.1>",
  "space_id": "<from Step 3.2>",
  "default_list_id": "<from Step 3.3>"
}
```

### workspace.notion
```json
{
  "meeting_log_db_id": "<from Step 2>",
  "sprint_reports_db_id": "<from Step 2>",
  "sow_tracker_db_id": "<from Step 2>",
  "changelog_db_id": "<from Step 2>",
  "comms_log_db_id": "<from Step 2>",
  "pm_state_db_id": "<from Step 2>"
}
```

### team[]
For each team member:
```json
{
  "name": "Full Name",
  "email": "email@varritech.com",
  "clickup_user_id": "<from Step 3.5>",
  "slack_user_id": "<from Slack admin or API>",
  "github_username": "<GitHub username>",
  "role": "Developer | PM Lead | Designer",
  "is_escalation_contact": false
}
```

To find Slack user IDs: use `SLACK_SEARCH_USERS` or check user profiles in Slack admin.

### projects
For each client project:
```json
{
  "project-name": {
    "client_name": "Client Company",
    "client_email": "contact@client.com",
    "sow_notion_page_id": "<from Notion>",
    "clickup_space_id": "<from ClickUp>",
    "slack_channel": "proj-name"
  }
}
```

---

## Step 5: Configure Slack Channels

Ensure these channels exist in your Slack workspace:

| Channel | Purpose | Create if missing |
|---------|---------|-------------------|
| `#project-updates` | Sprint reports, meeting summaries, SOW milestones | Yes |
| `#pm-alerts` | Overdue task escalations | Yes |
| `#daily-standup` | Daily standup summaries (optional) | Optional |
| Per-project channels | Project-specific notifications | As needed |

Update channel names in `config.json` → `channels` if different.

---

## Step 6: Set Fathom API Key

```bash
export FATHOM_API_KEY="your-fathom-api-key"
```

Get your API key from: Fathom → Settings → API → Generate Key

Add to your shell profile (`.zshrc` or `.bashrc`) for persistence.

---

## Step 7: Test Each Workflow

### Test A: Meeting Processing
```
"Process last meeting"
```
Expected: Fetches latest Fathom recording, creates ClickUp tasks, logs to Notion Meeting Log, posts Slack summary.

### Test B: Sprint Report
```
"Sprint report"
```
Expected: Queries ClickUp tasks in current sprint, creates Notion Sprint Report page, posts Slack summary.

### Test C: Overdue Detection
```
"What's overdue?"
```
Expected: Lists overdue tasks with escalation levels. Sends Slack alerts for escalation/critical level.

### Test D: SOW Status
```
"Update SOW for project-alpha"
```
Expected: Recalculates milestone progress from linked ClickUp tasks, updates Notion SOW Tracker.

### Test E: PR Linkage
```
"Link PR #42 to CU-abc123"
```
Expected: Updates ClickUp task status, adds PR comment, creates Notion Changelog entry.

---

## Troubleshooting

### "Connection not active" errors
Re-authenticate via `COMPOSIO_MANAGE_CONNECTIONS` with the toolkit name.

### ClickUp status update fails
Status names are case-sensitive and list-specific. Run `CLICKUP_GET_LIST` and check the `statuses` array for exact names.

### Notion database property errors
Property names must match exactly. Check `references/notion-database-schemas.md` for correct names and types.

### Fathom API returns 401
Check that `FATHOM_API_KEY` is set in the current shell environment.

### Slack message not delivered
Verify the channel name in config matches the actual Slack channel. Use `SLACK_FIND_CHANNELS` to search.
