---
name: boldsign-automation
description: "Automate BoldSign e-signature workflows via Composio: send documents for signing, track status, embedded signing, reminders. Always search tools first for current schemas."
requires:
  mcp: [connect-apps]
---

# BoldSign Automation via Composio

Automate BoldSign e-signature workflows through Composio's BoldSign toolkit.

## Prerequisites

- Composio MCP must be connected (COMPOSIO_SEARCH_TOOLS available)
- Active BoldSign connection via `COMPOSIO_MANAGE_CONNECTIONS` with toolkit `boldsign`
- BoldSign requires an API key (not OAuth) — generate one at https://app.boldsign.com → API menu
- Always call `COMPOSIO_SEARCH_TOOLS` first to get current tool schemas

## Setup

1. Sign up at https://boldsign.com (free sandbox available for testing)
2. Go to API menu → Generate API Key (sandbox or live)
3. Call `COMPOSIO_MANAGE_CONNECTIONS` with toolkit `boldsign` and provide the API key
4. Confirm connection status shows ACTIVE before running any workflows

## Core Workflows

### 1. Send Document for E-Signature

**When to use**: Send any PDF/document for signing — no template required

**Primary tool**: `BOLDSIGN_DOCUMENT_SEND`

**Key parameters**:
- `title`: Document title shown in UI and emails
- `files`: Array of `{fileName, base64}` — base64-encoded file content
- `fileUrls`: Alternative — array of public URLs (use instead of `files`)
- `signers`: Array of `{name, emailAddress}` — recipients who must sign
- `message`: Instructions for all recipients
- `enableSigningOrder`: Enforce sequential signing
- `reminderSettings`: `{enableAutoReminder, reminderDays, reminderCount}`
- `autoDetectFields`: Auto-detect fillable form fields in PDFs
- `expiryDays`: Days until document expires

**Pitfalls**:
- `files[].base64` must be a data-URI format: `data:application/pdf;base64,{content}`
- Either provide `files` or `fileUrls`, not both
- If `formFields` are omitted, either provide valid fields or use `autoDetectFields: true`
- Sending is irreversible — confirm signer details before dispatch

### 2. Create Embedded Signing Link

**When to use**: Generate a URL for in-app/iframe signing (client never leaves your site)

**Primary tool**: `BOLDSIGN_EMBEDDED_REQUEST_CREATE_LINK`

**Key parameters**:
- `Title`: Document title
- `Signers`: Array of `{Name, EmailAddress}`
- `Files`: Uploaded files (or `FileUrls` for URL-based)
- `RedirectUrl`: Where to redirect after signing completes
- `Locale`: UI language (EN, FR, DE, ES, etc.)

**Use case**: Varritech instant quote tool — client signs contract without leaving varritech.com

### 3. Edit a Draft or Sent Document

**When to use**: Update signers, files, or settings after creation

**Primary tool**: `BOLDSIGN_DOCUMENT_EDIT_BETA`

**Key parameters**:
- `documentId`: ID of the document to edit
- `Signers`: Array with `EditAction` (Add/Update/Remove)
- `Files`: Array with `EditAction` for file changes
- `ReminderSettings`: Update reminder configuration

### 4. Track Document Status

**When to use**: Check who has signed and monitor progress

**Primary tools**: `BOLDSIGN_DOCUMENT_LIST` / `BOLDSIGN_DOCUMENT_TEAM_LIST`

**Pitfalls**:
- `totalRecordsCount` can be 0 right after sending — use `documentId` from send response as primary confirmation
- "My Documents" visibility differs from team scope — use `BOLDSIGN_DOCUMENT_TEAM_LIST` if documents appear missing

### 5. Upload Files Separately

**When to use**: Pre-upload files before attaching to documents

**Primary tool**: `BOLDSIGN_FILE_UPLOAD`

**Key parameters**:
- `file_name`: Filename
- `mimetype`: MIME type (e.g., `application/pdf`)
- `base64`: Base64-encoded content

## Integration Pattern: Instant Quote → Contract

Full pipeline for programmatic contract generation and signing:

```
1. Client fills quote form on varritech.com
2. API generates quote (AI complexity analysis)
3. Contract PDF generated via TEXT_TO_PDF_CONVERT_TEXT_TO_PDF
4. Contract sent via BOLDSIGN_DOCUMENT_SEND or BOLDSIGN_EMBEDDED_REQUEST_CREATE_LINK
5. Client signs electronically
6. Varritech notified of completion
```

## Security Features

| Feature | Description |
|---------|-------------|
| Email OTP | One-time password sent via email before signing |
| SMS OTP | One-time password sent via SMS |
| Access Code | Pre-shared PIN required to view document |
| ID Verification | Photo ID + selfie matching |
| Signing Order | Enforce sequential signing (1-50 signers) |

## Pricing Reference

| Plan | Cost | Includes |
|------|------|----------|
| Sandbox (testing) | Free | Watermarked docs, auto-deleted after 14 days |
| Enterprise API | $30/month | 40 signature requests |
| Pay-as-you-go | $0.75/request | After 40 included |

## Quick Reference

| Task | Tool Slug | Key Params |
|------|-----------|------------|
| Send for signing | BOLDSIGN_DOCUMENT_SEND | title, files/fileUrls, signers |
| Embedded signing | BOLDSIGN_EMBEDDED_REQUEST_CREATE_LINK | Title, Signers, Files |
| Edit document | BOLDSIGN_DOCUMENT_EDIT_BETA | documentId, Signers, Files |
| List documents | BOLDSIGN_DOCUMENT_LIST | (optional filters) |
| Team documents | BOLDSIGN_DOCUMENT_TEAM_LIST | (optional filters) |
| Upload file | BOLDSIGN_FILE_UPLOAD | file_name, mimetype, base64 |
