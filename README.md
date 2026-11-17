# PlacementHQ

PlacementHQ is a Next.js 14 placement operations dashboard. Email/password authentication verifies team accounts, a private Central Google Sheet controls roles and approval, and Next.js server routes read Discord, parse placements, calculate analytics, and enforce permissions. A deliberately small Google Apps Script web app is the private read/write transport for Google Sheets.

## Architecture

```text
Browser
  ├─ Email/password login → Next.js API → Central users approval
  ├─ Optional manager workbook creation → Google OAuth Sheets/Drive consent
  └─ Placement Sync button → protected Next.js API route

Next.js server
  ├─ verifies bcrypt password hashes and issues PlacementHQ JWT cookies
  ├─ reads Discord channel history with the bot token
  ├─ parses and deduplicates placement messages
  ├─ calculates dashboard statistics and validates every operation
  └─ sends allowlisted Sheet operations and date-range queries to Apps Script

Apps Script gateway
  └─ authenticates one shared server secret and reads/writes Google Sheets

Google Sheets
  ├─ Central: users, batches, sheets, audit_log, system_config
  ├─ Operations: students, attendance, tasks, reports, and related tabs
  ├─ Placement Management by year: 01_YYYY through 12_YYYY, placement_sync_log, config
  └─ Daily Scrum by year: W01_YYYY through W53_YYYY, scrum_sync_log, config
```

Google authorization and PlacementHQ login have different jobs:

- **Email/password login** verifies a bcrypt hash stored in the private users tab. Registration creates a pending, inactive account.
- **Central `users` tab** decides whether that email may enter and which role it receives.
- **Manager OAuth consent** is optional and only lets an approved manager create a new private workbook in their own Drive.
- **Apps Script** authorizes normal workbook reads and writes. It contains no Discord parsing, account rules, statistics, or placement business logic.

## Prerequisites

- Node.js 20+
- A Google Cloud project
- Google Sheets API enabled
- Google Drive API enabled only when managers will create workbooks from the UI
- A deployed Apps Script web app copied from `apps-script/Code.gs`
- A Google OAuth 2.0 Web application client only when using optional manager workbook creation
- A Discord application and bot installed in the target server
- A Central Google Sheet, an operational Sheet, and a Placement Management Sheet

This design does not require a paid automation service. Google and your hosting provider still enforce their normal quotas.

## 1. Install

```bash
npm install
Copy-Item .env.example .env.local
```

Generate different random values of at least 32 characters for `GOOGLE_APPS_SCRIPT_SECRET`, `GOOGLE_OAUTH_COOKIE_SECRET`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. `GOOGLE_OAUTH_COOKIE_SECRET` is needed only if manager workbook creation is enabled.

## 2. Enable Google APIs

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create the project used by PlacementHQ.
3. Open **APIs & Services → Library**.
4. Search for **Google Sheets API**, open it, and click **Enable**.
5. Enable **Google Drive API** too only if managers will create new workbooks from the app.

## 3. Configure OAuth consent

1. Open **Google Auth Platform → Branding** and complete the app name, support email, and developer contact.
2. Open **Audience**.
3. Choose **Internal** when every user belongs to the same Google Workspace organization. Otherwise choose **External** and add your test accounts while the app is in testing.
4. Open **Data Access** and confirm the app can request basic identity, Google Sheets, and per-file Drive access.

User login does not use Google OAuth. OAuth is optional and used only for the separate manager workbook-creation connection. Skip sections 3–4 if managers will attach existing workbooks instead.

## 4. Create OAuth credentials

1. Open **Google Auth Platform → Clients**.
2. Click **Create client**.
3. Select **Web application**.
4. Add this local JavaScript origin:

```text
http://localhost:3000
```

5. Add this local redirect URI exactly:

```text
http://localhost:3000/api/google/oauth/callback
```

6. For production, add the HTTPS production origin and the equivalent production callback URL.
7. Copy the client ID and client secret into `.env.local`:

```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
```

Restart the app whenever environment variables change.

## 5. Deploy the minimal Apps Script gateway

Use an organization-controlled Google account that owns, or has Editor access to, every PlacementHQ workbook.

1. Open the Central workbook and choose **Extensions → Apps Script**.
2. Replace `Code.gs` with the contents of `apps-script/Code.gs` from this repository.
3. Open **Project Settings**, enable **Show appsscript.json manifest file in editor**, then replace the manifest with `apps-script/appsscript.json`.
4. In **Project Settings → Script properties**, add `GOOGLE_APPS_SCRIPT_SECRET`. Its value must exactly match the private 32+ character `GOOGLE_APPS_SCRIPT_SECRET` stored in Next.js. The legacy property name `PLACEMENTHQ_SECRET` is also accepted.
5. Save the project. Run `doGet` once from the editor and approve the requested Google Sheets permission if Google asks.
6. Choose **Deploy → New deployment → Web app**.
7. Set **Execute as** to **Me** and **Who has access** to **Anyone**. The shared secret still rejects unauthenticated operations; never publish the secret.
8. Deploy and copy the URL ending in `/exec`. Do not use the `/dev` test URL.
9. Add the same URL and secret to `.env.local` or your host's encrypted server settings:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your-deployment-id/exec
GOOGLE_APPS_SCRIPT_SECRET=the-exact-same-private-32-plus-character-secret
GOOGLE_SHEETS_PRINCIPAL_EMAIL=the-deploying-google-account@example.com
```

10. Add the workbook IDs described in section 6 and restart Next.js.
11. Whenever `Code.gs` changes, choose **Deploy → Manage deployments → Edit → New version → Deploy**. Saving the editor alone does not update the `/exec` deployment.

The gateway accepts only `values.get`, `values.update`, `values.append`, `values.batchUpdate`, `values.query`, the backward-compatible `values.queryDateRange`, `spreadsheets.get`, and `spreadsheets.batchUpdate`. Next.js may send an inclusive date range, exact/contains/list filters, an offset, and a limit. Apps Script returns only matching raw rows plus pagination metadata; Next.js calculates calendars, totals, leaderboards, companies, batches, and every other statistic.

Stable workbook domains and worksheet names live in `src/constants/sheets.ts`. Use `SHEET_DOMAIN` for Central registry keys, `SHEET_TAB` for physical worksheet names, and `SHEET_RESOURCE` when resolving a domain to its primary tab. Current managed resources include placements, daily goals, weekly KPIs, monthly KPIs, quarterly OKRs, students, companies, and audit logs.

Do not call the Apps Script URL from browser code. The Next.js server is the only client and keeps `GOOGLE_APPS_SCRIPT_SECRET` private. Direct Google OAuth, service-account JSON, and ADC support remain as compatibility fallbacks when the Apps Script variables are absent, but they are not required for this setup.

## 6. Prepare the workbooks

An approved manager can create templates from **Manager → Sheet Management**. Every successfully created workbook is automatically registered in the configured Central workbook's `sheets` tab with its spreadsheet ID, primary worksheet, template domain, access mode, creator, timestamps, and active status. The **Performance Management** template creates `monthly_kpis`, `quarterly_okrs`, and `config`, then registers both performance tabs under their own domains. Before the first approved account exists, use your existing Central workbook or create a private one manually with a `users` tab. Demo mode disables real provisioning.

### Central workbook

Required tabs:

- `users`
- `batches`
- `sheets` (`sheet_connections` remains readable only for legacy installations)
- `audit_log`
- `system_config`

The app automatically adds missing password-authentication columns to the right side of the `users` header without deleting existing data. The managed columns are:

```text
id, name, email, role, status, active, password_hash,
last_login_at, created_at, updated_at
```

Ensure the Apps Script deploying account can edit the Central workbook. Keep General access **Restricted**, copy its spreadsheet ID, and configure:

```env
GOOGLE_CENTRAL_SPREADSHEET_ID=central-spreadsheet-id
```

The ID is the value between `/d/` and `/edit` in the Sheet URL.

### Operations workbook

Ensure the Apps Script deploying account can edit the existing operational workbook and configure:

```env
GOOGLE_SPREADSHEET_ID=operations-spreadsheet-id
```

### Placement Management workbook

Create one workbook for each calendar year from **Manager → Sheet Management**, or attach an existing private workbook there. The manager chooses the year scope and exact workbook. Ensure the Apps Script deploying account can edit every assigned workbook.

```env
GOOGLE_PLACEMENT_SPREADSHEET_ID=placement-spreadsheet-id
```

The preferred dynamic configuration is one active registry row per year in Central `sheets`:

```text
domain=placement_information
batch=2026
spreadsheet_id=<placement spreadsheet ID>
worksheet_name=01_2026
access_mode=read_write
status=connected
active=true
```

The **Initialize workbook** action on `/manager/placement` creates and validates the assigned year's structure:

- `01_YYYY` through `12_YYYY`, storing each placement directly in its posting month
- `placement_sync_log`
- `config` when the workbook is created from the managed template

It never overwrites existing rows or a conflicting header. A sync range must remain inside one calendar year, and the Central `sheets.batch` value selects which annual workbook receives the data. The newest active registry row for that year is the effective assignment.

### Daily Scrum workbook

Create one **Daily Scrum Management** workbook for each calendar year from **Manager → Sheet Management**. The template creates `W01_YYYY` through `W53_YYYY`, `scrum_sync_log`, and `config`, then registers the workbook automatically. To attach an existing workbook, use:

```text
domain=scrum_updates
batch=2026
spreadsheet_id=<scrum spreadsheet ID>
worksheet_name=W01_2026
access_mode=read_write
status=connected
active=true
```

The optional `GOOGLE_SCRUM_SPREADSHEET_ID` fallback can point directly to one annual workbook, but the Central registry is preferred because it resolves the correct workbook dynamically by year. Open `/manager/scrum`, initialize missing weekly tabs, test Discord, choose a Saturday-through-Friday week and employee, inspect raw updates by date, then sync. Rows are deduplicated by Discord message ID.

To enable concise weekly AI summaries, create a Google AI Studio API key and add it only to the server environment. The summary endpoint calculates update, contributor, active-day, and blocker metrics before asking Gemini for a short operational summary.

```env
GEMINI_API_KEY=your-private-google-ai-studio-key
GEMINI_MODEL=gemini-3.7-flash
```

## 7. Registration, approval, and email/password login

1. Start the app with `npm run dev`.
2. Open `http://localhost:3000/login`.
3. Choose **Create account**, enter your name, email, requested role, and password.
4. Submit the request. The server saves a bcrypt hash (never the password) with `status=pending` and `active=false`. No session is created.
5. Open Central → `users` and find your email.
6. Set `role` to `admin`, `manager`, or `mentor`.
7. Set `status` to `active`.
8. Set `active` to `true`.
9. Return to **Sign in** and enter the same email and password.

Use `admin` for the first administrative account. Registration permits only requested `manager` or `mentor` roles; only a trusted administrator may grant `admin`. Do not paste plaintext passwords into `password_hash`.

Existing bcrypt-backed accounts keep their passwords. Previous Google-only rows have no password: they cannot log in or be overwritten by public registration. Before re-registering your own Google-only test account, have the Sheet owner archive its row. Approval is not email-ownership verification; administrators should verify the applicant before activation.

Suspending access requires either `status=suspended` or `active=false`. Refresh-token renewal rechecks the Sheet, so deactivated users cannot continue indefinitely.

## 8. Configure Discord

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Open your PlacementHQ application and select **Bot**.
3. Create the bot if needed and reset/copy its token.
4. Enable **Message Content Intent**.
5. In **Installation**, enable **Guild Install**.
6. Add the `bot` scope.
7. Grant only these bot permissions:
   - View Channels
   - Read Message History
8. Install the bot into the Discord server using an administrator account.
9. In the `successfully-placed` and `scrum-updates` channel permissions, allow the bot to view the channel and read message history. Check category overrides too.
10. Enable Discord Developer Mode, right-click the server and channel, and copy their IDs.
11. Configure `.env.local`:

```env
DISCORD_BOT_TOKEN=raw-token-without-Bot-prefix
DISCORD_GUILD_ID=server-id
DISCORD_PLACEMENT_CHANNEL_ID=successfully-placed-channel-id
DISCORD_SCRUM_CHANNEL_ID=scrum-updates-channel-id
```

Restart the app. Open `/manager/placement`, initialize the workbook, test Discord, choose a date range, and sync.

## Scrum message format

The Scrum parser accepts `Yesterday`, `Today`, and `Blockers` plus common aliases such as `Done`, `Plan`, and `Impediments`. Recommended format:

```text
Yesterday: Completed the student import review.
Today: Validate placement records and follow up with mentors.
Blockers: Waiting for company confirmation.
```

Messages without recognized headings are preserved with `parse_status=needs_review`; they are never silently discarded. Bot-authored messages are ignored.

## Placement message format

The parser accepts common label aliases. Recommended format:

```text
@everyone
Candidate Name: Md. Atikul Haq Rana
Email: ranakhandev2025@gmail.com
Company: Neurosoftic
Location: Green Road, Dhaka-1215
Position: Full Stack Developer
Job type: Intern
Batch: 13
Course: L1
Project Name: EJP 13
Verified By Confirmation Message
```

Stored fields include Discord message ID/link, timestamp, mentor Discord ID/name, blank mentor email, candidate details, verification status, raw content, parse status/errors, and future additional information. Re-syncing uses Discord message ID for idempotent insert/update behavior and preserves manually reviewed fields.

## Environment summary

| Variable                          | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `GOOGLE_APPS_SCRIPT_URL`          | Deployed minimal Sheet gateway URL ending in `/exec`             |
| `GOOGLE_APPS_SCRIPT_SECRET`       | Shared server-only secret also stored in Apps Script properties  |
| `GOOGLE_SHEETS_PRINCIPAL_EMAIL`   | Apps Script deploying account, used for protected header editors |
| `GOOGLE_CENTRAL_SPREADSHEET_ID`   | Users, approvals, roles, registry, audit                         |
| `GOOGLE_SPREADSHEET_ID`           | Existing operational dashboard data                              |
| `GOOGLE_PLACEMENT_SPREADSHEET_ID` | Optional explicit placement workbook                             |
| `GOOGLE_SCRUM_SPREADSHEET_ID`     | Optional explicit annual Daily Scrum workbook                    |
| `GOOGLE_OAUTH_CLIENT_ID`          | Optional OAuth client for manager workbook creation              |
| `GOOGLE_OAUTH_CLIENT_SECRET`      | Optional private OAuth client secret for that flow               |
| `GOOGLE_OAUTH_REDIRECT_URI`       | Manager workbook-consent callback                                |
| `GOOGLE_OAUTH_COOKIE_SECRET`      | Encrypts OAuth state/session cookies                             |
| `JWT_ACCESS_SECRET`               | Signs 15-minute app sessions                                     |
| `JWT_REFRESH_SECRET`              | Signs 7-day refresh sessions                                     |
| `DISCORD_BOT_TOKEN`               | Server-side Discord API authorization                            |
| `DISCORD_PLACEMENT_CHANNEL_ID`    | Placement source channel                                         |
| `DISCORD_SCRUM_CHANNEL_ID`        | Daily Scrum source channel                                       |
| `DISCORD_GUILD_ID`                | Discord server used in message links                             |
| `GEMINI_API_KEY`                  | Server-only Google AI Studio key for weekly Scrum summaries      |
| `GEMINI_MODEL`                    | Optional Gemini model override                                   |

## Security rules

- Keep all workbooks restricted; grant access only to approved humans and the configured backend identity.
- Never use `NEXT_PUBLIC_` for Google, Discord, JWT, cron, or email secrets.
- Never expose the Apps Script secret, Discord token, OAuth secret, or JWT secrets in browser code.
- Never prefix `GEMINI_API_KEY` with `NEXT_PUBLIC_`; summaries must use the protected Next.js route.
- Keep the Apps Script project private and rotate both copies of its shared secret if it is exposed.
- Keep Discord bot permissions read-only for placement and Scrum channels.
- Treat Central `users` as the authorization source of truth.
- Back up existing Sheets before migration and keep previous workbooks read-only until row counts are verified.

## Validation

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

The production build script gives the Next.js worker a larger Node heap to avoid Windows build-time memory exhaustion. Development output uses `.next-dev` while production output uses `.next`, so running a build cannot invalidate CSS chunks served by an open local development server.
