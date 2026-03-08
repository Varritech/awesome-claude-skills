---
name: sprint-manager
type: project-management
color: "#4ECDC4"
description: Manages sprint lifecycle in ClickUp. Creates sprints, tracks velocity, detects overdue tasks, generates sprint reports in Notion, and handles resource allocation visibility.
capabilities:
  - sprint_creation
  - velocity_tracking
  - overdue_detection
  - sprint_reporting
  - resource_allocation
priority: high
---

# Sprint Manager

Handles the full sprint lifecycle: creation, monitoring, overdue detection, reporting, and resource visibility.

## Core Workflows

### 1. Sprint Report

Generate a comprehensive sprint report from ClickUp data and publish to Notion.

**Tool sequence:**

1. Read PM State from Notion to get `current_sprint_list_id` and `current_sprint_number`

2. `CLICKUP_GET_TASKS` [Required]
   - `list_id`: current sprint list ID
   - `include_closed`: true
   - `subtasks`: true
   - `page`: 0 (paginate if > 100 tasks)

3. Categorize all tasks:
   ```
   completed    = tasks where status.type == "closed" or status matches config done/closed
   in_progress  = tasks where status.type == "open" and status != backlog
   overdue      = tasks where due_date < now AND status.type == "open"
   blocked      = tasks where status matches "blocked" (if such status exists)
   backlog      = tasks where status matches "backlog" or similar
   ```

4. Calculate metrics:
   ```
   velocity         = completed.length (or sum of story points if custom field exists)
   total_planned    = completed.length + in_progress.length + overdue.length
   completion_rate  = (completed.length / total_planned) * 100
   carry_over       = in_progress.length + overdue.length
   ```

5. Per-member breakdown:
   ```
   Group completed tasks by assignee → { member_name: task_count }
   Group overdue tasks by assignee → { member_name: [task_names] }
   ```

6. `NOTION_INSERT_ROW_DATABASE` [Required]
   - `database_id`: `config.workspace.notion.sprint_reports_db_id`
   - Properties:
     - "Sprint": title → "Sprint <N> (<start_date> - <end_date>)"
     - "Velocity": number → velocity
     - "Completion Rate": number → completion_rate
     - "Carry Over": number → carry_over
     - "Date Range": date → { start, end }
     - "Status": select → "Completed"

7. `NOTION_ADD_MULTIPLE_PAGE_CONTENT` [Required]
   - `page_id`: the newly created page ID from step 6
   - `content_blocks` (NOT `child_blocks`):
     - `heading_1`: "Sprint <N> Report"
     - `paragraph`: "Sprint ran from <start> to <end>. <completed>/<total> tasks completed (<rate>%)."
     - `heading_2`: "Velocity & Completion"
     - `paragraph`: "Velocity: <velocity> tasks. Completion rate: <rate>%. Carry-over: <carry_over> tasks."
     - `heading_2`: "Team Distribution"
     - `bulleted_list_item` per member: "<name>: <count> tasks completed"
     - `heading_2`: "Carry-Over Items"
     - `numbered_list_item` per carry-over task: "<task_name> — @<assignee> (due <date>)"
     - `heading_2`: "Overdue Items"
     - `numbered_list_item` per overdue task: "<task_name> — @<assignee> (<days> days overdue)"
     - `divider`: {}

8. Return payload for Stakeholder Communicator:
   ```json
   {
     "sprint_name": "Sprint 5 (Mar 1 - Mar 14)",
     "velocity": 23,
     "completion_rate": 82,
     "carry_over_count": 5,
     "completed_count": 23,
     "overdue_count": 2,
     "top_contributors": [{"name": "Dev A", "count": 8}],
     "report_page_url": "https://notion.so/xxx"
   }
   ```

### 2. Overdue Detection

Detect tasks past their due date and assign escalation levels.

**Tool sequence:**

1. `CLICKUP_GET_TASKS` [Required]
   - `list_id`: current sprint list ID (from PM State)
   - `due_date_lt`: current timestamp in Unix ms
   - `statuses`: all open statuses from config (comma-separated)
   - Note: `due_date_lt` filters for tasks due BEFORE this timestamp

2. For each overdue task, calculate escalation level:
   ```
   days_overdue = Math.floor((Date.now() - task.due_date) / 86400000)

   if days_overdue <= config.escalation.overdue_warning_days:     level = "warning"
   elif days_overdue <= config.escalation.overdue_escalation_days: level = "escalation"
   else:                                                           level = "critical"
   ```

3. Resolve assignee details from config.team[] for each task

4. Return payload:
   ```json
   {
     "overdue_tasks": [
       {
         "task_name": "Implement auth flow",
         "task_id": "abc123",
         "task_url": "https://app.clickup.com/t/abc123",
         "assignee_name": "Dev A",
         "assignee_slack_id": "U0DEF5678",
         "days_overdue": 3,
         "escalation_level": "escalation",
         "original_due_date": "2026-03-05"
       }
     ]
   }
   ```

### 3. Sprint Creation

Create a new sprint structure in ClickUp and optionally move carry-over tasks.

**Tool sequence:**

1. Read PM State for `current_sprint_number`
2. New sprint number = current + 1
3. Calculate date range: start = today, end = today + `config.sprints.duration_days`

4. `CLICKUP_CREATE_FOLDER` [Required]
   - `space_id`: `config.workspace.clickup.space_id`
   - `name`: "<config.workspace.clickup.sprint_folder_prefix> <new_number>"

5. `CLICKUP_CREATE_LIST` [Required]
   - `folder_id`: newly created folder ID
   - `name`: "Sprint <N> Tasks"
   - `due_date`: sprint end date in Unix ms
   - `status`: use default statuses

6. If `config.sprints.auto_create_next` and carry-over tasks exist:
   - For each carry-over task from the previous sprint:
     - `CLICKUP_UPDATE_TASK` to move to new list (update `list_id` field or use move endpoint)
     - Note: ClickUp may require creating a new task in the new list + closing the old one if direct move isn't supported

7. Update PM State in Notion:
   - `current_sprint_number` → new number
   - `current_sprint_list_id` → new list ID
   - `current_sprint_end_date` → end date ISO string

### 4. Resource Allocation View

Show task distribution across team members to identify overloaded or underutilized members.

**Tool sequence:**

1. `CLICKUP_GET_TASKS` for current sprint list (all open tasks)
2. Group by assignee:
   ```
   per_member = {
     "Dev A": { total: 8, in_progress: 3, overdue: 1 },
     "Dev B": { total: 4, in_progress: 2, overdue: 0 },
     "Unassigned": { total: 2, in_progress: 0, overdue: 0 }
   }
   ```
3. Flag members with > 10 tasks or > 2 overdue as "overloaded"
4. Present as a formatted table to the user

## ClickUp Pitfalls

- `due_date` is Unix milliseconds, not seconds and not ISO strings
- `statuses` parameter for filtering is a comma-separated string of exact status names (case-sensitive)
- `include_closed: true` is needed to see completed tasks in reports
- Pagination: default page size is 100; if `last_page` is false, fetch `page + 1`
- `team_id` in the ClickUp API means workspace ID, not a team/group
- Task `assignees` is an array of user objects; get user IDs from `assignees[].id`
