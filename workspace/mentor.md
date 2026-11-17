# Mentor Mentee Sheet Management

This document is the source of truth for the mentor-side mentee import workflow. AI agents and maintainers must update it whenever the registry schema, import rules, statuses, permissions, or worksheet layout changes.

## Purpose

Mentors provide a Google Sheet that is shared as **Anyone with the link — Viewer**. PlacementHQ reads the selected worksheet, creates a private managed worksheet inside the Placement DBMS spreadsheet, imports the mentees, and registers the active assignment in the `batchs` tab. The public source is never edited.

## Mentor workflow

1. Open **Mentor → Mentees**.
2. Enter the Google Sheet link, source worksheet name, batch name, level, and duration.
3. Confirm the source has public viewer access.
4. Select **Import mentees**.
5. PlacementHQ validates the source columns and statuses, creates a new DBMS worksheet, copies the rows, and adds an active `batchs` registry row.
6. Status and note changes made in PlacementHQ update only the private DBMS worksheet.

Importing a replacement creates a new uniquely named DBMS worksheet and marks the mentor's previous `batchs` row inactive. Historical worksheets and registry rows are retained for auditability.

## `batchs` registry schema

The Placement DBMS main spreadsheet owns a worksheet named exactly `batchs` with these columns in this order:

| Column | Header | Meaning |
| --- | --- | --- |
| A | `worksheet_name` | Managed worksheet created in Placement DBMS |
| B | `mentor_name` | Mentor display name from the authenticated account |
| C | `discord_username` | Mentor Discord username from the central users sheet |
| D | `discord_id` | Stable Discord user ID used to associate the active row |
| E | `batch` | Batch supplied during import |
| F | `level` | `Level-1` or `Level-2` |
| G | `is_active` | `true` for the current assignment; previous imports become `false` |
| H | `sheet_id_or_link` | Original public Google Sheet link |
| I | `added_date` | ISO-8601 import timestamp |
| J | `duration` | Integer duration from 1 through 6 months |

Do not reorder or rename these headers. The application rejects incompatible headers to avoid corrupting registry data.

## Managed mentee worksheet schema

Every imported worksheet in Placement DBMS uses these columns in this order:

1. `student_name`
2. `email`
3. `phone`
4. `batch`
5. `status`
6. `notes`

The selected batch is written to every imported row, making the registry assignment authoritative. Header aliases such as `name`, `student_email`, `phone_number`, `current_status`, and `status_note` are accepted from the public source and normalized to the managed schema.

## Allowed statuses

- Interview Attempt 1
- Interview Attempt 2
- Interview Attempt 3
- Interview Attempt 4
- Interview Attempt 5
- Interview Attempt 6
- Interview Attempt 7
- Interview Attempt 8
- Interview Attempt 9
- Interview Attempt 10
- Hired
- Joined
- Blocked
- Kicked Out
- Not Continued

Blank source statuses default to `Interview Attempt 1`. Any other non-blank value rejects the import and reports the source row number. The managed worksheet also receives a Google Sheets dropdown validation for the allowed list.

## Security and access rules

- The source workbook needs viewer access only; PlacementHQ must not request public editor access.
- The destination Placement DBMS remains private and is accessed through server-side Google credentials or the private Apps Script gateway.
- A mentor can read and update only the worksheet associated with their Discord ID.
- Mentor name and Discord identity are taken from the authenticated central user record, never trusted from browser form input.
- Do not store passwords, authentication tokens, or sensitive private notes in either sheet.

## Code ownership

- Constants and statuses: `src/constants/sheets.ts`, `src/constants/placement.ts`
- Input validation: `src/lib/validators/mentor-student-sheet.schema.ts`
- Registry, import, and managed worksheet operations: `src/lib/mentor-batch-sheets.ts`
- API authorization: `src/app/api/mentor/student-sheet/route.ts`
- Mentor UI: `src/components/mentor/mentor-student-sheet-workspace.tsx`
- Admin registry UI: `src/components/sheets/mentor-student-sheet-registry.tsx`

## Change checklist for AI agents

When modifying this feature:

1. Preserve the exact registry and managed worksheet header order or provide an explicit migration.
2. Keep the status constant, API validation, UI selector, and Google Sheets data validation synchronized.
3. Maintain viewer-only source access and private destination writes.
4. Keep replacement imports non-destructive by retaining old worksheets and marking old registry rows inactive.
5. Run TypeScript/build validation and relevant tests.
6. Update this document with any behavioral or schema change.

## Weekly goals

Mentors use **Mentor → Weekly Goals** for the current Dhaka reporting week.

- Drafts support any number of goal rows.
- The server assigns the current week; past and future week selection is unavailable.
- A mentor can submit only once per week. Submitted goals are immutable.
- Mentors can append notes after submission; existing notes are not edited.
- Managers see the selected employee's saved goals before creating a Scrum summary.
- Scrum summaries compare all weekly updates against saved goals first.
- If no goals were submitted, the summary extracts only explicit goals from the employee's final Scrum day.

The Performance Management workbook owns the `weekly_goals` worksheet with this exact header order:

`id`, `week_key`, `week_number`, `year`, `week_start`, `week_end`, `user_id`, `user_email`, `user_name`, `discord_user_id`, `discord_username`, `goals_json`, `comments_json`, `created_at`, `updated_at`.

Code ownership:

- Sheet operations: `src/lib/weekly-goals/sheets.ts`
- Types and validation: `src/lib/weekly-goals/types.ts`, `src/lib/validators/weekly-goals.schema.ts`
- API: `src/app/api/weekly-goals/route.ts`
- Mentor UI: `src/components/performance/weekly-goals-workspace.tsx`

## Placement follow-ups

Mentors use **Mentor → Placement Follow-ups** for manual 45-day and 90-day employment check-ins.

- Candidates are sourced from synced placement workbooks and restricted to the signed-in mentor.
- The `placement_followups` worksheet is created in the Central System workbook on first use.
- Each placement supports one 45-day and one 90-day email record.
- A completed milestone disables that row for the selected period; candidates with both milestones completed are hidden.
- Mentors may connect Gmail with `gmail.send`; otherwise the configured central Gmail sender is used.
- Individual and selected bulk actions open a Gmail-style composer with To, CC, Subject, and Body fields.
- Production always sends to the stored student email. Development may override To for safe delivery testing.
- Bulk sends remain separate personalized messages with each student's name, role, and company rendered independently.
- Bulk delivery runs sequentially and continues when one candidate email fails.
- The signed-in mentor is always enforced as CC by the server.
- Generated HTML email content is left-aligned without a centered fixed-width wrapper.
- The approved message links to `https://forms.gle/itxvQtvzFbcinsce9` and signs off with the authenticated mentor's name.
- The composer keeps its Send action visible in a fixed footer while the message fields scroll on smaller screens.

Required sender configuration:

- `GOOGLE_GMAIL_REFRESH_TOKEN` with `gmail.send`, or a `GOOGLE_SHEETS_REFRESH_TOKEN` that also has `gmail.send`.
- `GMAIL_FROM_EMAIL`, defaulting to `meet@programminghero.org`.
- `NEXT_PUBLIC_APP_URL` for production response links.
