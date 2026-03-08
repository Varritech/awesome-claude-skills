# Notion Database Schemas

These are the 6 databases required by the Varritech AI PM system. Create them in a dedicated Notion workspace page (e.g., "AI PM System") or run `scripts/setup-notion-databases.py` to create them automatically.

After creation, copy each database ID into `config.json` → `workspace.notion`.

---

## 1. Meeting Log

**Purpose:** Records every processed Fathom meeting with action items and task references.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| Meeting Title | Title | Primary key |
| Date | Date | Meeting date (ISO 8601) |
| Attendees | Multi-select | Auto-populated from calendar invitees |
| Summary | Rich text | AI-generated meeting summary (truncated to 2000 chars) |
| Action Items Count | Number | Integer — how many ClickUp tasks were created |
| ClickUp Task IDs | Rich text | Comma-separated task IDs |
| Fathom Link | URL | Link to Fathom recording |
| Status | Select | Options: `Processed`, `Pending`, `Archived` |
| Project | Select | Options: one per project in config |

---

## 2. Sprint Reports

**Purpose:** Stores sprint metrics and links to detailed report pages.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| Sprint | Title | Format: "Sprint N (start - end)" |
| Velocity | Number | Tasks completed (or story points sum) |
| Completion Rate | Number | Percentage 0-100 |
| Carry Over | Number | Tasks moved to next sprint |
| Date Range | Date | Range: start to end date |
| Status | Select | Options: `Active`, `Completed`, `Cancelled` |

---

## 3. SOW Tracker

**Purpose:** Tracks project milestones, deliverables, and progress linked to ClickUp tasks.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| Milestone | Title | Milestone name |
| Project | Select | Options: one per project in config |
| Status | Select | Options: `Not Started`, `In Progress`, `Complete`, `At Risk` |
| Progress | Number | Percentage 0-100 |
| Due Date | Date | Target completion date |
| Completion Date | Date | Actual completion (set when Status → Complete) |
| Deliverables | Rich text | List of deliverables for this milestone |
| Linked Tasks | Rich text | Comma-separated ClickUp task IDs |
| Order | Number | Sequence within the SOW (1, 2, 3...) |

---

## 4. Changelog

**Purpose:** Log of merged PRs linked to ClickUp tasks for release tracking.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| PR Title | Title | Pull request title |
| PR URL | URL | GitHub PR link |
| Date | Date | Merge date |
| Author | Rich text | GitHub username |
| Linked Tasks | Rich text | Comma-separated ClickUp task IDs |
| Project | Select | Options: one per project in config |

---

## 5. Comms Log

**Purpose:** Audit trail of all notifications sent by the PM system.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| Message | Title | Subject or summary of the sent message |
| Type | Select | Options: `Slack`, `Email`, `DM` |
| Channel/Recipient | Rich text | Slack channel name or email address |
| Timestamp | Date | When the message was sent |
| Triggered By | Select | Options: `Meeting`, `Sprint`, `Overdue`, `SOW`, `PR`, `Manual` |
| Content Hash | Rich text | Deduplication key (optional) |

---

## 6. PM State

**Purpose:** System metadata for persistent state across agent invocations.

| Property Name | Type | Options / Notes |
|---------------|------|-----------------|
| Key | Title | State key name |
| Value | Rich text | State value (string) |
| Updated | Date | Last updated timestamp |

**Initial rows to create:**

| Key | Initial Value | Purpose |
|-----|---------------|---------|
| `last_fathom_recording_id` | (empty) | Dedup for Fathom polling |
| `current_sprint_number` | `1` | Active sprint number |
| `current_sprint_list_id` | (ClickUp list ID) | Active sprint's ClickUp list |
| `current_sprint_end_date` | (ISO date) | When current sprint ends |

---

## Composio Tool Reference

To create databases programmatically:

```
COMPOSIO_SEARCH_TOOLS → queries: [{ use_case: "create a Notion database" }]
→ Tool: NOTION_CREATE_NOTION_DATABASE (if available)
→ Fallback: Create manually in Notion UI and copy database IDs
```

To get a database ID from Notion:
- Open the database in Notion
- The URL format is: `https://www.notion.so/<workspace>/<database_id>?v=<view_id>`
- The database ID is the 32-character hex string (add hyphens: 8-4-4-4-12 format)
