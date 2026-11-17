import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { google, sheets_v4 } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const CENTRAL_SHEETS = [
  {
    envName: 'GOOGLE_CENTRAL_SPREADSHEET_ID',
    tabs: {
      users: ['id', 'name', 'email', 'role', 'status', 'active', 'password_hash', 'last_login_at', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
      batches: ['batch', 'name', 'project', 'status', 'start_date', 'end_date', 'created_at', 'updated_at', 'active'],
      sheet_connections: ['id', 'domain', 'spreadsheet_id', 'spreadsheet_title', 'worksheet_name', 'access_mode', 'status', 'protected_headers', 'attached_by', 'attached_at', 'updated_at', 'active', 'batch'],
      audit_log: ['id', 'actor_id', 'actor_email', 'actor_role', 'action', 'target_type', 'target_id', 'metadata', 'ip_address', 'user_agent', 'created_at'],
      system_config: ['key', 'value', 'description'],
    },
  },
] as const;

async function ensureTab(client: sheets_v4.Sheets, spreadsheetId: string, name: string, headers: readonly string[]) {
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === name);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } }] },
    });
    console.log(`  Created tab: ${name}`);
  }
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${name}!A1:${columnName(headers.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[...headers]] },
  });
}

function columnName(columnCount: number) {
  let value = columnCount;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

async function setupSheets() {
  const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN?.trim();
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = credentialsJson
    ? JSON.parse(credentialsJson) as Record<string, unknown> & { client_email?: string }
    : undefined;
  const principalEmail = process.env.GOOGLE_SHEETS_PRINCIPAL_EMAIL || credentials?.client_email;
  if (!principalEmail) throw new Error('GOOGLE_SHEETS_PRINCIPAL_EMAIL is required');
  const auth = refreshToken ? (() => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_SHEETS_REFRESH_TOKEN requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
    }
    const oauth = new google.auth.OAuth2(clientId, clientSecret);
    oauth.setCredentials({ refresh_token: refreshToken });
    return oauth;
  })() : new google.auth.GoogleAuth({
      ...(credentials ? { credentials } : {}),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  const client = google.sheets({ version: 'v4', auth });

  for (const centralSheet of CENTRAL_SHEETS) {
    const spreadsheetId = process.env[centralSheet.envName];
    if (!spreadsheetId) throw new Error(`${centralSheet.envName} is not set in .env.local`);
    console.log(`Setting up ${centralSheet.envName}...`);
    for (const [name, headers] of Object.entries(centralSheet.tabs)) {
      await ensureTab(client, spreadsheetId, name, headers);
    }
  }

  console.log('\nCentral sheets are ready.');
  console.log(`Google Sheets principal: ${principalEmail}`);
  console.log('Register with email and password, then approve the pending users row by setting role, status=active, and active=true.');
}

setupSheets().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
