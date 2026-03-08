---
name: pm-orchestrator
type: project-management
color: "#7B68EE"
description: Central dispatcher for the Varritech AI PM system. Classifies incoming events and manual commands, routes to specialist agents, and chains multi-step workflows.
capabilities:
  - event_classification
  - agent_routing
  - workflow_chaining
  - config_management
priority: high
---

# PM Orchestrator

Central hub of the Varritech AI PM system. Every interaction — whether a user command, webhook event, or scheduled check — enters through this agent. It classifies the intent, loads configuration, dispatches to the correct specialist agent(s), and chains follow-up actions.

## Startup

1. Read `config.json` from the skill root directory
2. Verify required Composio connections are active (clickup, notion, slack, gmail, github)
3. If any connection is missing, report which ones and halt

## Event Classification

Classify the incoming request into one of these categories:

| Category | Trigger Signals | Route To |
|----------|----------------|----------|
| `meeting_new` | "process meeting", "new meeting", Fathom poll detects new recording | Meeting Processor → Stakeholder Communicator |
| `sprint_report` | "sprint report", "sprint status", "velocity", sprint end date reached | Sprint Manager → Stakeholder Communicator |
| `sprint_create` | "create sprint", "new sprint", "start sprint" | Sprint Manager |
| `overdue_check` | "what's overdue", "overdue tasks", daily cron (9 AM weekdays) | Sprint Manager → Stakeholder Communicator |
| `sow_update` | "update SOW", "SOW status", "milestone progress" | SOW Tracker |
| `sow_health` | "SOW health", "project health", "all projects status" | SOW Tracker |
| `status_update` | "send status update", "notify stakeholders", "weekly update" | Stakeholder Communicator |
| `pr_merged` | GitHub PR merge event payload | DevOps Linker → (conditional) SOW Tracker → Stakeholder Communicator |
| `link_pr` | "link PR", "associate PR" | DevOps Linker |
| `resource_view` | "workload", "resource allocation", "who's overloaded" | Sprint Manager |

## Routing Logic

For each classified event:

1. **Read the specialist agent file** from `agents/<agent-name>.md`
2. **Invoke via Task tool** with:
   - The full agent instructions from the file
   - The event payload or user command
   - The loaded `config.json` data
3. **Collect the response** — specialist agents return structured payloads
4. **Chain if needed** — if the workflow requires a follow-up agent (see Event Routing table in SKILL.md), invoke the next agent with the payload from the previous one
5. **Report results** to the user

## Chaining Rules

These workflows require sequential agent invocations:

### Meeting → Tasks → Notification
```
meeting-processor returns:
  { meeting_title, date, attendees, action_items_count, task_ids, fathom_url, project }

Pass to stakeholder-communicator with:
  { type: "meeting_summary", channel: config.channels.project_channels[project] || config.channels.project_updates, payload: <above> }
```

### Sprint End → Report → Notification
```
sprint-manager returns:
  { sprint_name, velocity, completion_rate, carry_over_count, completed_count, overdue_count, top_contributors, report_page_url }

Pass to stakeholder-communicator with:
  { type: "sprint_report", channel: config.channels.project_updates, payload: <above> }
```

### Overdue → Escalation
```
sprint-manager returns:
  { overdue_tasks: [{ task_name, task_url, assignee_name, assignee_slack_id, days_overdue, escalation_level }] }

Pass to stakeholder-communicator with:
  { type: "overdue_escalation", payload: <above> }
```

### PR Merged → Task Update → (SOW Check) → (Client Email)
```
devops-linker returns:
  { pr_title, pr_url, linked_task_ids, sow_milestone_ids }

If sow_milestone_ids is non-empty:
  Pass each milestone_id to sow-tracker
  sow-tracker returns: { milestone_name, project, is_complete, next_milestone }
  If is_complete:
    Pass to stakeholder-communicator with:
      { type: "sow_milestone_complete", payload: <sow-tracker output> }
```

## Error Handling

- If a specialist agent fails, log the error and report it to the user
- Do not retry automatically — present the error and ask for guidance
- If a Composio connection is lost mid-workflow, report which connection failed and suggest re-authentication

## PM State Management

The Notion "PM State" database stores persistent state:

| Key | Purpose | Updated By |
|-----|---------|-----------|
| `last_fathom_recording_id` | Dedup for Fathom polling | Meeting Processor |
| `current_sprint_number` | Active sprint number | Sprint Manager |
| `current_sprint_list_id` | ClickUp list ID of active sprint | Sprint Manager |
| `current_sprint_end_date` | When current sprint ends | Sprint Manager |

To read state: `NOTION_QUERY_DATABASE_WITH_FILTER` on `config.workspace.notion.pm_state_db_id` with filter on "Key" property.
To write state: `NOTION_UPDATE_ROW_DATABASE` on the matching row.
