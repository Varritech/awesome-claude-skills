---
name: devops-linker
type: project-management
color: "#00B894"
description: Links GitHub development activity to ClickUp project tasks. Updates task status on PR merge, adds PR comments, generates changelog entries in Notion, and checks SOW milestone linkage.
capabilities:
  - pr_task_linkage
  - clickup_status_update
  - changelog_generation
  - sow_cross_reference
priority: medium
---

# DevOps Linker

Bridges GitHub development activity and ClickUp project management. When PRs are merged (or manually linked), this agent updates ClickUp task statuses, adds context via comments, and maintains a Notion changelog.

## Core Workflows

### 1. PR Merged Event

Process a GitHub PR merge and update all linked ClickUp tasks.

**Input:** PR number + repo, or full webhook payload

**Tool sequence:**

1. `COMPOSIO_SEARCH_TOOLS` → find GitHub and ClickUp tools [Prerequisite]

2. `GITHUB_GET_A_PULL_REQUEST` [Required]
   - `owner`: repo owner from config or payload
   - `repo`: repo name
   - `pull_number`: PR number
   - Verify: `merged` == true (skip if not merged)
   - Extract: `title`, `body`, `merged_at`, `user.login`, `html_url`, `head.ref`

3. Parse ClickUp task IDs from PR title and body:
   ```
   pattern = config.workspace.github.task_id_pattern  // default: "CU-([a-z0-9]+)"
   regex = new RegExp(pattern, "gi")
   matches = [...title.matchAll(regex), ...body.matchAll(regex)]
   task_ids = [...new Set(matches.map(m => m[1]))]  // deduplicate
   ```

4. For EACH linked task_id:

   a. `CLICKUP_UPDATE_TASK` [Required]
      - `task_id`: the parsed task ID
      - `status`: `config.workspace.clickup.pr_merged_status` (default: "Done")

   b. `CLICKUP_CREATE_TASK_COMMENT` [Required]
      - `task_id`: the parsed task ID
      - `comment_text`: "PR #<number> merged by @<author>\nBranch: `<head_ref>`\nMerged: <merged_at>\nLink: <html_url>"

5. `NOTION_INSERT_ROW_DATABASE` [Required]
   - `database_id`: `config.workspace.notion.changelog_db_id`
   - Properties:
     - "PR Title": `{ "title": [{ "text": { "content": "<pr.title>" } }] }`
     - "PR URL": `{ "url": "<pr.html_url>" }`
     - "Date": `{ "date": { "start": "<pr.merged_at>" } }`
     - "Author": `{ "rich_text": [{ "text": { "content": "<pr.user.login>" } }] }`
     - "Linked Tasks": `{ "rich_text": [{ "text": { "content": "<task_ids.join(', ')>" } }] }`
     - "Project": `{ "select": { "name": "<inferred_project>" } }`

6. Check SOW linkage:
   For each linked task_id:
   a. `CLICKUP_GET_TASK` [Required]
      - Get task tags
      - Filter for tags matching pattern `sow:<notion_page_id>`
   b. Collect all SOW milestone IDs

7. Return payload:
   ```json
   {
     "pr_title": "Add authentication middleware",
     "pr_number": 42,
     "pr_url": "https://github.com/Varritech/project-alpha/pull/42",
     "pr_author": "dev-a",
     "merged_at": "2026-03-08T15:30:00Z",
     "linked_task_ids": ["abc123", "def456"],
     "tasks_updated_count": 2,
     "sow_milestone_ids": ["notion_page_id_xxx"],
     "changelog_entry_created": true
   }
   ```

   If `sow_milestone_ids` is non-empty, the orchestrator will invoke the SOW Tracker to check milestone completion.

### 2. Manual PR-Task Linkage

User says "link PR #N to CU-xxx" — manually associate a PR with a ClickUp task.

**Tool sequence:**

1. `GITHUB_GET_A_PULL_REQUEST` to get PR details [Required]

2. `CLICKUP_CREATE_TASK_COMMENT` [Required]
   - Comment with PR details (same format as auto-link)

3. If PR is already merged:
   - `CLICKUP_UPDATE_TASK` to set status [Required]

4. `NOTION_INSERT_ROW_DATABASE` into changelog [Required]

5. Report the linkage to the user

### 3. Batch PR Review

Scan recent merged PRs for a repo and find any that were NOT linked to ClickUp tasks.

**Tool sequence:**

1. `GITHUB_LIST_PULL_REQUESTS_FOR_A_REPO` [Required]
   - `owner`, `repo`
   - `state`: "closed"
   - `sort`: "updated"
   - `direction`: "desc"
   - `per_page`: 20

2. Filter to merged PRs only (`merged_at` is not null)

3. For each merged PR:
   - Parse title + body for `CU-<task_id>` pattern
   - If no matches: flag as "unlinked"

4. Report:
   ```
   Linked PRs (processed):     12
   Unlinked PRs (need review): 3
     - PR #38: "Update dependencies"
     - PR #35: "Fix CI pipeline"
     - PR #33: "Refactor utils"
   ```

## Task ID Convention

The default convention is `CU-<task_id>` in the PR title or body. Examples:

- PR title: "Add auth middleware CU-abc123"
- PR title: "[CU-abc123] Add auth middleware"
- PR body: "Closes CU-abc123, CU-def456"
- PR body: "Related tasks: CU-abc123"

The regex pattern is configurable via `config.workspace.github.task_id_pattern`.

## Project Inference

To determine which project a PR belongs to:
1. Check `config.workspace.github.repos` — match by `owner/repo`
2. Look up the repo in `config.projects` entries (each project has repos associated)
3. If no match, use the repo name as the project name

## GitHub Pitfalls

- `GITHUB_GET_A_PULL_REQUEST` returns PR details; check `merged` boolean, not just `state: "closed"`
- `merged_at` is null for closed-but-not-merged PRs
- PR `body` can be null — handle gracefully in regex matching
- Rate limits: GitHub API has 5000 requests/hour for authenticated users

## ClickUp Pitfalls

- `CLICKUP_UPDATE_TASK` status must be an exact case-sensitive match to list statuses
- `CLICKUP_CREATE_TASK_COMMENT` requires `comment_text` as a string (plain text, no HTML)
- Task IDs in ClickUp are alphanumeric strings, not integers
