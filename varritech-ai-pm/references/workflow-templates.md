# Workflow Message Templates

Templates used by the Stakeholder Communicator agent. Variables are denoted with `<variable_name>`.

---

## Slack Templates

### sprint-status-slack

```
*Sprint Report: <sprint_name>*

:chart_with_upwards_trend: *Velocity:* <velocity> tasks | *Completion:* <completion_rate>%

:white_check_mark: *Completed:* <completed_count>
:arrows_counterclockwise: *Carry-over:* <carry_over_count>
:warning: *Overdue:* <overdue_count>

*Top Contributors:*
<for_each_contributor>
• <name>: <count> tasks
</for_each_contributor>

:page_facing_up: <report_page_url|Full Report in Notion>
```

### overdue-alert-slack

**Warning level:**
```
:wave: Heads up: *<task_name>* is <days_overdue> day(s) overdue.
Need help or a date extension? Reply here or update the task.
:link: <task_url|View in ClickUp>
```

**Escalation level:**
```
:rotating_light: *OVERDUE* — <task_name>
*Assigned to:* <@<assignee_slack_id>> | *Days overdue:* <days_overdue>
*Due date:* <original_due_date>
:link: <task_url|View in ClickUp>
```

**Critical level:**
```
:red_circle: *CRITICAL OVERDUE* — <task_name>
*Assigned to:* <@<assignee_slack_id>> | *Days overdue:* <days_overdue>
*Due date:* <original_due_date>
This task requires immediate attention. cc <@<pm_lead_slack_id>>
:link: <task_url|View in ClickUp>
```

### meeting-summary-slack

```
*Meeting Processed: <meeting_title>*
:calendar: *Date:* <date> | *Attendees:* <attendee_names>

*<action_items_count> Action Items Created:*
<for_each_task>
• <task_name> — @<assignee_name> (due <due_date>) `<priority>`
</for_each_task>

<if_unmatched_assignees>
:warning: *Unmatched assignees:* <unmatched_names> (assigned to PM Lead)
</if_unmatched_assignees>

:link: <fathom_url|Fathom Recording>
```

### sow-milestone-slack

```
:tada: *SOW Milestone Complete*
*Project:* <project_name>
*Milestone:* <milestone_name>
*Completed:* <completion_date>
*Next:* <next_milestone_name> (due <next_due_date>)
Client notification sent to <client_email>.
```

### pr-merged-slack

```
:merged: *PR Merged:* <pr_title>
*Author:* <pr_author> | *Repo:* <repo>
*Linked Tasks:* <linked_task_ids>
:link: <pr_url|View PR>
```

---

## Email Templates

### sow-milestone-email

**Subject:** `[<project_name>] Milestone Complete: <milestone_name>`

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #171470;">Milestone Complete: <milestone_name></h2>

  <p>Hi <client_name>,</p>

  <p>We're pleased to confirm that the following milestone has been completed:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Project</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><project_name></td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Milestone</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><milestone_name></td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Completed</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><completion_date></td>
    </tr>
  </table>

  <h3 style="color: #171470;">Deliverables</h3>
  <ul>
    <li><deliverable_1></li>
    <li><deliverable_2></li>
    <li><deliverable_3></li>
  </ul>

  <h3 style="color: #171470;">Next Milestone</h3>
  <p><strong><next_milestone_name></strong> — Target: <next_due_date></p>

  <p>Please review the deliverables and let us know if you have any questions.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

  <p>
    <strong>Varritech</strong><br>
    <a href="mailto:christian@varritech.com">christian@varritech.com</a><br>
    <a href="https://wa.me/message">WhatsApp</a>
  </p>
</body>
</html>
```

### overdue-critical-email

**Subject:** `[CRITICAL OVERDUE] <task_name> — <days_overdue> days past due`

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #ff4444; color: white; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
    <strong>CRITICAL: Task Overdue</strong>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Task</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><task_name></td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Assigned To</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><assignee_name></td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Due Date</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><original_due_date></td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Days Overdue</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: #ff4444;"><strong><days_overdue> days</strong></td>
    </tr>
  </table>

  <p><strong>Suggested Actions:</strong></p>
  <ol>
    <li>Contact <assignee_name> to understand blockers</li>
    <li>Reassign if the original assignee is unavailable</li>
    <li>Adjust the due date if scope has changed</li>
    <li>Escalate to project stakeholders if this affects a milestone</li>
  </ol>

  <p><a href="<task_url>" style="background: #171470; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">View Task in ClickUp</a></p>
</body>
</html>
```

### weekly-digest-email

**Subject:** `Weekly Project Digest — <date>`

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #171470;">Weekly Project Digest</h2>
  <p style="color: #666;"><date></p>

  <for_each_project>
  <div style="border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
    <h3 style="margin-top: 0; color: #171470;"><project_name></h3>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 8px;"><strong>Sprint Velocity</strong></td>
        <td style="padding: 4px 8px;"><velocity> tasks</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px;"><strong>Completion Rate</strong></td>
        <td style="padding: 4px 8px;"><completion_rate>%</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px;"><strong>SOW Progress</strong></td>
        <td style="padding: 4px 8px;"><current_milestone> (<milestone_progress>%)</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px;"><strong>Overdue Tasks</strong></td>
        <td style="padding: 4px 8px;"><overdue_count></td>
      </tr>
    </table>

    <if_blockers>
    <p style="color: #ff4444;"><strong>Blockers:</strong> <blocker_list></p>
    </if_blockers>
  </div>
  </for_each_project>

  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p>
    <strong>Varritech</strong><br>
    <a href="mailto:christian@varritech.com">christian@varritech.com</a><br>
    <a href="https://wa.me/message">WhatsApp</a>
  </p>
</body>
</html>
```
