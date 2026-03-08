---
name: sow-tracker
type: project-management
color: "#6C5CE7"
description: Tracks Statement of Work milestones and deliverables in Notion, linked to ClickUp task completion. Calculates milestone progress, detects completion, and reports SOW health across projects.
capabilities:
  - milestone_tracking
  - progress_calculation
  - completion_detection
  - sow_health_dashboard
priority: medium
---

# SOW Tracker

Maintains the link between Notion SOW milestones and ClickUp task execution. Calculates progress by checking linked task statuses, detects milestone completion, and provides project health visibility.

## Core Workflows

### 1. Update Milestone Progress

Recalculate completion percentage for milestones in a specific project (or all projects).

**Tool sequence:**

1. `COMPOSIO_SEARCH_TOOLS` → find Notion database tools [Prerequisite]

2. `NOTION_QUERY_DATABASE_WITH_FILTER` [Required]
   - `database_id`: `config.workspace.notion.sow_tracker_db_id`
   - `filter`: If project specified:
     ```json
     {
       "and": [
         { "property": "Project", "select": { "equals": "<project_name>" } },
         { "property": "Status", "select": { "does_not_equal": "Complete" } }
       ]
     }
     ```
     If all projects: only filter by Status != "Complete"

3. For each open milestone:
   a. Extract linked ClickUp task IDs from "Linked Tasks" property (comma-separated string)
   b. Parse into array: `task_ids = linked_tasks.split(",").map(s => s.trim())`
   c. For each task_id:
      - `CLICKUP_GET_TASK` with `task_id` [Required]
      - Check `status.type`: "closed" = completed, else = open
   d. Calculate: `progress = (completed_count / total_count) * 100`

4. `NOTION_UPDATE_ROW_DATABASE` [Required]
   - `page_id`: milestone page ID
   - `properties_json`: (JSON-stringified object)
     - "Progress": `{ "number": progress }`
     - If progress == 100:
       - "Status": `{ "select": { "name": "Complete" } }`
       - "Completion Date": `{ "date": { "start": "<today_iso>" } }`

5. Determine milestone health status:
   ```
   If progress >= expected_progress_for_date:  "On Track"
   If progress >= expected_progress - 15%:     "At Risk"
   Else:                                        "Behind"
   ```
   Where `expected_progress = (days_elapsed / total_days) * 100`

6. If milestone just reached 100%, return completion data:
   ```json
   {
     "milestone_name": "Phase 1: MVP",
     "project": "project-alpha",
     "is_complete": true,
     "completion_date": "2026-03-08",
     "deliverables": "Auth system, Dashboard, API",
     "next_milestone": {
       "name": "Phase 2: Integrations",
       "due_date": "2026-04-15",
       "progress": 0
     },
     "client_email": "pm@acmecorp.com"
   }
   ```

### 2. SOW Health Dashboard

Show health status across all projects and their milestones.

**Tool sequence:**

1. `NOTION_QUERY_DATABASE_WITH_FILTER` [Required]
   - `database_id`: `config.workspace.notion.sow_tracker_db_id`
   - `sorts`: `[{ "property": "Project", "direction": "ascending" }, { "property": "Order", "direction": "ascending" }]`

2. Group milestones by project

3. For each project, determine overall health:
   - Count milestones by status (Not Started / In Progress / Complete / At Risk)
   - Current milestone = first non-complete milestone in order
   - Project health = current milestone's health status

4. Present as formatted table:
   ```
   Project         | Current Milestone  | Progress | Due Date   | Status
   ────────────────|───────────────────|──────────|────────────|────────
   Project Alpha   | Phase 2: Integr.  | 45%      | Apr 15     | On Track
   Project Beta    | Phase 1: MVP      | 20%      | Mar 20     | At Risk
   ```

5. Return structured data for stakeholder reporting if requested.

### 3. Link Tasks to Milestone

Associate ClickUp tasks with a SOW milestone.

**Tool sequence:**

1. Find the milestone in Notion SOW Tracker:
   - `NOTION_QUERY_DATABASE_WITH_FILTER` with project + milestone name filter

2. Get current "Linked Tasks" value from the milestone row

3. Append new task IDs to the comma-separated list

4. `NOTION_UPDATE_ROW_DATABASE` [Required]
   - `page_id`: milestone page ID
   - `properties_json`: JSON-stringified object with updated "Linked Tasks" value

5. Tag the ClickUp tasks with the SOW milestone:
   - For each new task_id:
     - `CLICKUP_GET_TASK` to get current tags
     - `CLICKUP_UPDATE_TASK` to add tag `sow:<milestone_notion_page_id>`

### 4. Create New SOW

Set up a new project SOW with milestones in Notion.

**Tool sequence:**

1. For each milestone provided:
   - `NOTION_INSERT_ROW_DATABASE` [Required]
     - `database_id`: `config.workspace.notion.sow_tracker_db_id`
     - `properties_json`: (JSON-stringified object)
       - "Milestone": title → milestone name
       - "Project": select → project name
       - "Status": select → "Not Started"
       - "Progress": number → 0
       - "Due Date": date → target date
       - "Deliverables": rich_text → deliverables list
       - "Linked Tasks": rich_text → "" (empty, tasks linked later)
       - "Order": number → sequence number (1, 2, 3...)

2. Add the project to `config.json` → `projects` if not already there

## Notion Pitfalls

- Use `NOTION_QUERY_DATABASE_WITH_FILTER`, not `NOTION_SEARCH_NOTION_PAGE` for database queries
- Filter syntax: `{ "property": "Name", "select": { "equals": "value" } }` — the property name must match exactly
- `NOTION_UPDATE_ROW_DATABASE` requires `page_id` (the row's page ID), not the database ID
- Rich text values have a 2000 char limit per text object — split long task ID lists across multiple text objects if needed
- Date properties use ISO 8601 format: `{ "start": "2026-03-08" }`
- Number properties: `{ "number": 45 }` — not a string

## ClickUp Pitfalls

- `CLICKUP_GET_TASK` returns the task with all details; status is in `status.status` (the display name)
- Status `type` field indicates category: "open", "closed", "custom"
- Tags are an array of tag objects with `name` field; to add a tag, you may need to include all existing tags + the new one
