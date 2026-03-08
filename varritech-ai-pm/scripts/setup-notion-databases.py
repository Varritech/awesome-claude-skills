#!/usr/bin/env python3
"""
Varritech AI PM — Notion Database Setup Script

Creates all 6 required Notion databases under a specified parent page.
Uses Composio's Notion integration via run_composio_tool helper.

Usage (in Composio Remote Workbench):
    Run this script's logic cell by cell, or execute via:
    exec(open("scripts/setup-notion-databases.py").read())

Prerequisites:
    - Active Notion connection via Composio
    - A parent Notion page ID where databases will be created
"""

import json
from datetime import datetime

# ============================================================
# CONFIGURATION — Set your parent page ID here
# ============================================================
PARENT_PAGE_ID = "PLACEHOLDER"  # Replace with your Notion page ID


# ============================================================
# DATABASE SCHEMAS
# ============================================================

DATABASES = [
    {
        "name": "Meeting Log",
        "config_key": "meeting_log_db_id",
        "properties": {
            "Meeting Title": {"title": {}},
            "Date": {"date": {}},
            "Attendees": {"multi_select": {"options": []}},
            "Summary": {"rich_text": {}},
            "Action Items Count": {"number": {"format": "number"}},
            "ClickUp Task IDs": {"rich_text": {}},
            "Fathom Link": {"url": {}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "Processed", "color": "green"},
                        {"name": "Pending", "color": "yellow"},
                        {"name": "Archived", "color": "gray"},
                    ]
                }
            },
            "Project": {"select": {"options": []}},
        },
    },
    {
        "name": "Sprint Reports",
        "config_key": "sprint_reports_db_id",
        "properties": {
            "Sprint": {"title": {}},
            "Velocity": {"number": {"format": "number"}},
            "Completion Rate": {"number": {"format": "percent"}},
            "Carry Over": {"number": {"format": "number"}},
            "Date Range": {"date": {}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "Active", "color": "blue"},
                        {"name": "Completed", "color": "green"},
                        {"name": "Cancelled", "color": "red"},
                    ]
                }
            },
        },
    },
    {
        "name": "SOW Tracker",
        "config_key": "sow_tracker_db_id",
        "properties": {
            "Milestone": {"title": {}},
            "Project": {"select": {"options": []}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "Not Started", "color": "gray"},
                        {"name": "In Progress", "color": "blue"},
                        {"name": "Complete", "color": "green"},
                        {"name": "At Risk", "color": "red"},
                    ]
                }
            },
            "Progress": {"number": {"format": "percent"}},
            "Due Date": {"date": {}},
            "Completion Date": {"date": {}},
            "Deliverables": {"rich_text": {}},
            "Linked Tasks": {"rich_text": {}},
            "Order": {"number": {"format": "number"}},
        },
    },
    {
        "name": "Changelog",
        "config_key": "changelog_db_id",
        "properties": {
            "PR Title": {"title": {}},
            "PR URL": {"url": {}},
            "Date": {"date": {}},
            "Author": {"rich_text": {}},
            "Linked Tasks": {"rich_text": {}},
            "Project": {"select": {"options": []}},
        },
    },
    {
        "name": "Comms Log",
        "config_key": "comms_log_db_id",
        "properties": {
            "Message": {"title": {}},
            "Type": {
                "select": {
                    "options": [
                        {"name": "Slack", "color": "purple"},
                        {"name": "Email", "color": "blue"},
                        {"name": "DM", "color": "yellow"},
                    ]
                }
            },
            "Channel/Recipient": {"rich_text": {}},
            "Timestamp": {"date": {}},
            "Triggered By": {
                "select": {
                    "options": [
                        {"name": "Meeting", "color": "orange"},
                        {"name": "Sprint", "color": "blue"},
                        {"name": "Overdue", "color": "red"},
                        {"name": "SOW", "color": "purple"},
                        {"name": "PR", "color": "green"},
                        {"name": "Manual", "color": "gray"},
                    ]
                }
            },
            "Content Hash": {"rich_text": {}},
        },
    },
    {
        "name": "PM State",
        "config_key": "pm_state_db_id",
        "properties": {
            "Key": {"title": {}},
            "Value": {"rich_text": {}},
            "Updated": {"date": {}},
        },
    },
]

PM_STATE_INITIAL_ROWS = [
    {"Key": "last_fathom_recording_id", "Value": ""},
    {"Key": "current_sprint_number", "Value": "1"},
    {"Key": "current_sprint_list_id", "Value": ""},
    {"Key": "current_sprint_end_date", "Value": ""},
]


def create_databases(parent_page_id: str):
    """Create all 6 databases and return their IDs for config.json."""
    created_ids = {}

    for db_schema in DATABASES:
        print(f"\nCreating database: {db_schema['name']}...")

        result, error = run_composio_tool(
            "NOTION_CREATE_NOTION_DATABASE",
            {
                "parent_page_id": parent_page_id,
                "title": db_schema["name"],
                "properties": db_schema["properties"],
            },
        )

        if error:
            print(f"  ERROR: {error}")
            created_ids[db_schema["config_key"]] = f"ERROR: {error}"
            continue

        db_id = result.get("data", {}).get("id", "unknown")
        created_ids[db_schema["config_key"]] = db_id
        print(f"  Created: {db_id}")

    return created_ids


def seed_pm_state(pm_state_db_id: str):
    """Add initial rows to the PM State database."""
    print(f"\nSeeding PM State database ({pm_state_db_id})...")

    for row in PM_STATE_INITIAL_ROWS:
        now_iso = datetime.utcnow().isoformat()
        result, error = run_composio_tool(
            "NOTION_INSERT_ROW_DATABASE",
            {
                "database_id": pm_state_db_id,
                "properties_json": json.dumps(
                    {
                        "Key": {
                            "title": [
                                {"text": {"content": row["Key"]}}
                            ]
                        },
                        "Value": {
                            "rich_text": [
                                {"text": {"content": row["Value"]}}
                            ]
                        },
                        "Updated": {"date": {"start": now_iso}},
                    }
                ),
            },
        )

        if error:
            print(f"  ERROR seeding '{row['Key']}': {error}")
        else:
            print(f"  Seeded: {row['Key']} = '{row['Value']}'")


def main():
    if PARENT_PAGE_ID == "PLACEHOLDER":
        print("ERROR: Set PARENT_PAGE_ID before running this script.")
        print("Get it from: Notion page URL → 32-char hex ID (add dashes: 8-4-4-4-12)")
        return

    print("=" * 60)
    print("Varritech AI PM — Notion Database Setup")
    print("=" * 60)
    print(f"Parent page: {PARENT_PAGE_ID}")

    created_ids = create_databases(PARENT_PAGE_ID)

    # Seed PM State if created successfully
    pm_state_id = created_ids.get("pm_state_db_id", "")
    if pm_state_id and not pm_state_id.startswith("ERROR"):
        seed_pm_state(pm_state_id)

    # Output config.json snippet
    print("\n" + "=" * 60)
    print("Copy this into config.json → workspace.notion:")
    print("=" * 60)
    print(json.dumps(created_ids, indent=2))


if __name__ == "__main__":
    main()
