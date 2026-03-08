---
name: stakeholder-communicator
type: project-management
color: "#FFD93D"
description: Handles all outbound communication for the PM system. Sends Slack messages and Gmail emails based on structured payloads from other agents. Logs all communications to Notion. Never self-triggered.
capabilities:
  - slack_notifications
  - email_communication
  - communication_logging
  - message_formatting
priority: medium
---

# Stakeholder Communicator

Outbound communication agent. Receives structured payloads from other PM agents and delivers formatted notifications via Slack and/or Gmail. Logs every communication to the Notion Comms Log.

**This agent is never invoked directly by events.** It is always called by the PM Orchestrator with a payload from another agent.

## Input Payload Format

Every invocation receives a payload with:
```json
{
  "type": "meeting_summary | sprint_report | overdue_escalation | sow_milestone_complete | weekly_digest | custom",
  "channel": "channel-name (optional, overrides default)",
  "payload": { ... }
}
```

## Notification Types

### 1. Meeting Summary (`type: "meeting_summary"`)

**Target:** Slack project channel (or #project-updates)

**Tool sequence:**
1. `COMPOSIO_SEARCH_TOOLS` → find Slack tools [Prerequisite]
2. `SLACK_FIND_CHANNELS` with `query`: payload.channel or `config.channels.project_updates` [Required]
3. `SLACK_SEND_MESSAGE` [Required]
   - `channel`: resolved channel ID
   - `markdown_text`:
     ```
     *Meeting Processed: <title>*
     :calendar: *Date:* <date> | *Attendees:* <names>

     *<count> Action Items Created:*
     <for each task>
     • <task_name> — @<assignee> (due <date>) `<priority>`
     </for each>

     <if unmatched_assignees>
     :warning: *Unmatched assignees:* <names> (assigned to PM Lead)
     </if>

     :link: <fathom_url|Fathom Recording>
     ```

### 2. Sprint Report (`type: "sprint_report"`)

**Target:** Slack #project-updates + email to stakeholders

**Slack — Tool sequence:**
1. `SLACK_FIND_CHANNELS` with `query`: `config.channels.project_updates` [Required]
2. `SLACK_SEND_MESSAGE` [Required]
   - `markdown_text`:
     ```
     *Sprint Report: <sprint_name>*

     :chart_with_upwards_trend: *Velocity:* <velocity> tasks | *Completion:* <rate>%

     :white_check_mark: *Completed:* <completed_count>
     :arrows_counterclockwise: *Carry-over:* <carry_over_count>
     :warning: *Overdue:* <overdue_count>

     *Top Contributors:*
     <for each contributor>
     • <name>: <count> tasks
     </for each>

     :page_facing_up: <report_page_url|Full Report in Notion>
     ```

**Email (if stakeholder emails configured):**
1. `COMPOSIO_SEARCH_TOOLS` → find Gmail tools [Prerequisite]
2. For each email in `config.escalation.escalation_email` (or per-project stakeholders):
3. `GMAIL_SEND_EMAIL` [Required]
   - `recipient_email`: stakeholder email
   - `subject`: "Sprint Report: <sprint_name>"
   - `body`: HTML formatted version of the sprint summary
   - `is_html`: true

### 3. Overdue Escalation (`type: "overdue_escalation"`)

**Target:** Varies by escalation level

For each overdue task in `payload.overdue_tasks`:

**Warning level (1-2 days overdue):**
1. `SLACK_SEND_MESSAGE` [Required]
   - DM to assignee (use `channel`: assignee's Slack user ID for DM)
   - `markdown_text`:
     ```
     :wave: Heads up: *<task_name>* is <days> day(s) overdue.
     Need help or a date extension? Reply here or update the task.
     :link: <task_url|View in ClickUp>
     ```

**Escalation level (3-5 days overdue):**
1. `SLACK_FIND_CHANNELS` with `query`: `config.channels.pm_alerts` [Required]
2. `SLACK_SEND_MESSAGE` to #pm-alerts [Required]
   - `markdown_text`:
     ```
     :rotating_light: *OVERDUE* — <task_name>
     *Assigned to:* @<assignee_name> | *Days overdue:* <days>
     :link: <task_url|View in ClickUp>
     ```
3. Also DM the assignee (same as warning level)

**Critical level (5+ days overdue):**
1. All of the above (Slack #pm-alerts + DM to assignee)
2. `GMAIL_SEND_EMAIL` [Required]
   - `recipient_email`: `config.escalation.escalation_email`
   - `subject`: "[CRITICAL OVERDUE] <task_name> — <days> days past due"
   - `body`: HTML with task details, assignee, link, and suggested actions
   - `is_html`: true

### 4. SOW Milestone Complete (`type: "sow_milestone_complete"`)

**Target:** Client email + Slack #project-updates

**Email to client:**
1. `GMAIL_SEND_EMAIL` [Required]
   - `recipient_email`: `config.projects[project].client_email`
   - `subject`: "[<project_name>] Milestone Complete: <milestone_name>"
   - `body`: HTML email:
     ```html
     <h2>Milestone Complete: <milestone_name></h2>
     <p>We're pleased to confirm that the following milestone has been completed:</p>
     <ul>
       <li><strong>Project:</strong> <project_name></li>
       <li><strong>Milestone:</strong> <milestone_name></li>
       <li><strong>Completed:</strong> <completion_date></li>
     </ul>
     <h3>Deliverables</h3>
     <ul>
       <li><deliverable_1></li>
       <li><deliverable_2></li>
     </ul>
     <h3>Next Milestone</h3>
     <p><strong><next_milestone_name></strong> — Target: <next_due_date></p>
     <p>Please review the deliverables and let us know if you have any questions.</p>
     <p>Best regards,<br>Varritech Team</p>
     ```
   - `is_html`: true

**Slack notification:**
1. `SLACK_SEND_MESSAGE` to project channel or #project-updates [Required]
   - `markdown_text`:
     ```
     :tada: *SOW Milestone Complete*
     *Project:* <project_name>
     *Milestone:* <milestone_name>
     *Next:* <next_milestone_name> (due <next_due_date>)
     Client notification sent to <client_email>.
     ```

### 5. Weekly Digest (`type: "weekly_digest"`)

**Target:** Email to stakeholders

Compile a cross-project summary from recent sprint reports, SOW status, and meeting logs.

1. Query Notion Sprint Reports DB for current sprint
2. Query Notion SOW Tracker for all active projects
3. `GMAIL_SEND_EMAIL` [Required]
   - `recipient_email`: `config.escalation.escalation_email`
   - `subject`: "Weekly Project Digest — <date>"
   - `body`: HTML with sections per project (sprint velocity, SOW progress, blockers)
   - `is_html`: true

## Communication Logging

After EVERY notification sent (Slack or email), log to Notion Comms Log:

1. `NOTION_INSERT_ROW_DATABASE` [Required]
   - `database_id`: `config.workspace.notion.comms_log_db_id`
   - Properties:
     - "Message": title → subject/summary of the message
     - "Type": select → "Slack" | "Email" | "DM"
     - "Channel/Recipient": rich_text → channel name or email address
     - "Timestamp": date → current ISO datetime
     - "Triggered By": select → "Meeting" | "Sprint" | "Overdue" | "SOW" | "Manual"

## Slack Pitfalls

- `SLACK_FIND_CHANNELS` returns channel objects; use the `id` field for `SLACK_SEND_MESSAGE`
- For DMs, pass the user's Slack user ID as the `channel` parameter
- Slack markdown uses `*bold*`, `_italic_`, `~strike~`, `` `code` ``
- Links: `<url|display text>`
- User mentions: `<@USER_ID>` (use Slack user ID, not name)
- Messages over 4000 chars will be truncated — keep summaries concise

## Gmail Pitfalls

- `is_html: true` enables HTML body rendering
- Always include plain-text-friendly content structure in case HTML doesn't render
- WhatsApp CTA should be included in client-facing emails per Varritech brand rules
