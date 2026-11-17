import { randomUUID } from 'crypto';
import { SHEET_TAB } from '@/constants';
import { getAuthUserById, type AuthUser } from '@/lib/auth/users';
import { extractSpreadsheetId } from '@/lib/sheets/attachments';
import { getSheetManagementSpreadsheetId, getSheetsClient } from '@/lib/sheets/client';
import type { JWTPayload } from '@/types';
import type { MentorStudentSheetAttachmentInput, MentorStudentStatusUpdateInput } from '@/lib/validators/mentor-student-sheet.schema';

const REGISTRY_TAB = SHEET_TAB.MENTOR_STUDENT_SHEETS;
const REGISTRY_HEADERS = [
  'id', 'mentor_id', 'mentor_name', 'mentor_email', 'spreadsheet_id', 'spreadsheet_title',
  'worksheet_name', 'sharing_mode', 'status', 'attached_at', 'updated_at', 'active',
  'discord_username', 'discord_user_id',
];
const STUDENT_HEADERS = [
  'student_id', 'student_name', 'student_email', 'batch', 'current_status',
  'status_note', 'updated_at', 'updated_by',
];

export interface MentorStudentSheetConnection {
  id: string;
  mentor_id: string;
  mentor_name: string;
  mentor_email: string;
  discord_username: string;
  discord_user_id: string;
  spreadsheet_title: string;
  worksheet_name: string;
  spreadsheet_url: string;
  attached_at: string;
  updated_at: string;
  status: 'connected';
}

export interface MentorStudentRow {
  row_number: number;
  student_id: string;
  student_name: string;
  student_email: string;
  batch: string;
  current_status: string;
  status_note: string;
  updated_at: string;
  updated_by: string;
}

interface StoredConnection extends MentorStudentSheetConnection {
  spreadsheet_id: string;
  active: boolean;
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

async function ensureRegistryTab() {
  const client = await getSheetsClient();
  const spreadsheetId = getSheetManagementSpreadsheetId();
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === REGISTRY_TAB);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: REGISTRY_TAB, gridProperties: { frozenRowCount: 1 } } } }] },
    });
  }
  const headerResponse = await client.spreadsheets.values.get({ spreadsheetId, range: `${quoteSheetName(REGISTRY_TAB)}!A1:N1` });
  const headers = (headerResponse.data.values?.[0] ?? []).map(String);
  if (!headers.length) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(REGISTRY_TAB)}!A1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [REGISTRY_HEADERS] },
    });
  } else if (REGISTRY_HEADERS.slice(0, 12).some((header, index) => headers[index] !== header)) {
    throw new Error(`The ${REGISTRY_TAB} tab headers do not match the PlacementHQ schema`);
  } else if (REGISTRY_HEADERS.slice(12).some((header, index) => headers[index + 12] !== header)) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(REGISTRY_TAB)}!M1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [REGISTRY_HEADERS.slice(12)] },
    });
  }
}

async function readRegistryRows() {
  await ensureRegistryTab();
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: getSheetManagementSpreadsheetId(),
    range: `${quoteSheetName(REGISTRY_TAB)}!A2:N`,
  });
  return response.data.values ?? [];
}

function rowToConnection(row: unknown[]): StoredConnection {
  const spreadsheetId = String(row[4] ?? '');
  return {
    id: String(row[0] ?? ''),
    mentor_id: String(row[1] ?? ''),
    mentor_name: String(row[2] ?? ''),
    mentor_email: String(row[3] ?? ''),
    discord_username: String(row[12] ?? ''),
    discord_user_id: String(row[13] ?? ''),
    spreadsheet_id: spreadsheetId,
    spreadsheet_title: String(row[5] ?? 'Untitled spreadsheet'),
    worksheet_name: String(row[6] ?? ''),
    spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    status: 'connected',
    attached_at: String(row[9] ?? ''),
    updated_at: String(row[10] ?? ''),
    active: String(row[11] ?? 'true') !== 'false',
  };
}

async function getMentorIdentity(user: JWTPayload): Promise<AuthUser> {
  const profile = await getAuthUserById(user.id);
  if (!profile) throw new Error('Your login account could not be matched with the central users sheet.');
  if (!profile.discord_user_id || !profile.discord_username) throw new Error('Ask an admin to add your Discord username and Discord user ID before connecting a student sheet.');
  return profile;
}

async function getMentorConnection(user: JWTPayload): Promise<StoredConnection | null> {
  const profile = await getMentorIdentity(user);
  const rows = await readRegistryRows();
  const email = user.email.trim().toLowerCase();
  let matchedIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const candidate = rows[index];
    if (String(candidate[11] ?? 'true') === 'false') continue;
    const discordIdMatches = String(candidate[13] ?? '').trim() === profile.discord_user_id;
    const accountMatches = String(candidate[1] ?? '') === user.id;
    const legacyEmailMatches = !candidate[13] && String(candidate[3] ?? '').trim().toLowerCase() === email;
    if (discordIdMatches || accountMatches || legacyEmailMatches) { matchedIndex = index; break; }
  }
  if (matchedIndex === -1) return null;
  const row = rows[matchedIndex];
  if (!row[12] || !row[13]) {
    const client = await getSheetsClient();
    await client.spreadsheets.values.update({
      spreadsheetId: getSheetManagementSpreadsheetId(),
      range: `${quoteSheetName(REGISTRY_TAB)}!M${matchedIndex + 2}:N${matchedIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[profile.discord_username, profile.discord_user_id]] },
    });
    row[12] = profile.discord_username;
    row[13] = profile.discord_user_id;
  }
  return rowToConnection(row);
}

function publicConnection(connection: StoredConnection): MentorStudentSheetConnection {
  return {
    id: connection.id,
    mentor_id: connection.mentor_id,
    mentor_name: connection.mentor_name,
    mentor_email: connection.mentor_email,
    discord_username: connection.discord_username,
    discord_user_id: connection.discord_user_id,
    spreadsheet_title: connection.spreadsheet_title,
    worksheet_name: connection.worksheet_name,
    spreadsheet_url: connection.spreadsheet_url,
    attached_at: connection.attached_at,
    updated_at: connection.updated_at,
    status: connection.status,
  };
}

async function readStudents(connection: StoredConnection): Promise<MentorStudentRow[]> {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: connection.spreadsheet_id,
    range: `${quoteSheetName(connection.worksheet_name)}!A2:H`,
  });
  return (response.data.values ?? []).map((row, index) => ({
    row_number: index + 2,
    student_id: String(row[0] ?? ''),
    student_name: String(row[1] ?? ''),
    student_email: String(row[2] ?? ''),
    batch: String(row[3] ?? ''),
    current_status: String(row[4] ?? 'learning'),
    status_note: String(row[5] ?? ''),
    updated_at: String(row[6] ?? ''),
    updated_by: String(row[7] ?? ''),
  })).filter((student) => student.student_id || student.student_name || student.student_email);
}

export async function getMentorStudentWorkspace(user: JWTPayload) {
  const connection = await getMentorConnection(user);
  if (!connection) return { connection: null, students: [] as MentorStudentRow[] };
  return { connection: publicConnection(connection), students: await readStudents(connection) };
}

export async function listMentorStudentSheetConnections(): Promise<MentorStudentSheetConnection[]> {
  const rows = await readRegistryRows();
  const seen = new Set<string>();
  return [...rows].reverse().map(rowToConnection).filter((connection) => {
    const identityKey = connection.discord_user_id || connection.mentor_id || connection.mentor_email;
    if (!connection.active || seen.has(identityKey)) return false;
    seen.add(identityKey);
    return true;
  }).map(publicConnection);
}

export async function attachMentorStudentSheet(user: JWTPayload, input: MentorStudentSheetAttachmentInput) {
  const profile = await getMentorIdentity(user);
  const spreadsheetId = extractSpreadsheetId(input.sheet_url);
  const client = await getSheetsClient();
  const metadata = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets(properties(sheetId,title))',
  });
  const worksheets = metadata.data.sheets ?? [];
  if (!worksheets.length) throw new Error('The spreadsheet has no worksheets');
  const worksheet = input.worksheet_name
    ? worksheets.find((sheet) => sheet.properties?.title === input.worksheet_name)
    : worksheets[0];
  const worksheetName = worksheet?.properties?.title;
  if (!worksheetName) throw new Error(input.worksheet_name ? `Worksheet “${input.worksheet_name}” was not found` : 'Unable to read the first worksheet');

  const headerRange = `${quoteSheetName(worksheetName)}!A1:H1`;
  const headerResponse = await client.spreadsheets.values.get({ spreadsheetId, range: headerRange });
  const headers = (headerResponse.data.values?.[0] ?? []).map(String);
  if (!headers.length) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: { values: [STUDENT_HEADERS] },
    });
  } else if (STUDENT_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error(`The ${worksheetName} worksheet already contains data with different headers. Use a blank worksheet or add the PlacementHQ student headers first.`);
  }

  await ensureRegistryTab();
  const registryRows = await readRegistryRows();
  const managementId = getSheetManagementSpreadsheetId();
  await Promise.all(registryRows.map(async (row, index) => {
    const sameMentor = String(row[13] ?? '').trim() === profile.discord_user_id
      || String(row[1] ?? '') === user.id
      || (!row[13] && String(row[3] ?? '').trim().toLowerCase() === user.email.trim().toLowerCase());
    if (sameMentor && String(row[11] ?? 'true') !== 'false') {
      await client.spreadsheets.values.update({
        spreadsheetId: managementId,
        range: `${quoteSheetName(REGISTRY_TAB)}!L${index + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['false']] },
      });
    }
  }));

  const now = new Date().toISOString();
  const id = randomUUID();
  await client.spreadsheets.values.append({
    spreadsheetId: managementId,
    range: `${quoteSheetName(REGISTRY_TAB)}!A:N`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[id, user.id, user.name, user.email, spreadsheetId, metadata.data.properties?.title ?? 'Untitled spreadsheet', worksheetName, 'anyone_with_link_edit', 'connected', now, now, 'true', profile.discord_username, profile.discord_user_id]] },
  });
  return publicConnection({ id, mentor_id: user.id, mentor_name: user.name, mentor_email: user.email, discord_username: profile.discord_username, discord_user_id: profile.discord_user_id, spreadsheet_id: spreadsheetId, spreadsheet_title: metadata.data.properties?.title ?? 'Untitled spreadsheet', worksheet_name: worksheetName, spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, status: 'connected', attached_at: now, updated_at: now, active: true });
}

export async function updateMentorStudentStatus(user: JWTPayload, input: MentorStudentStatusUpdateInput) {
  const connection = await getMentorConnection(user);
  if (!connection) throw new Error('Attach your student Google Sheet first.');
  const client = await getSheetsClient();
  const rowResponse = await client.spreadsheets.values.get({
    spreadsheetId: connection.spreadsheet_id,
    range: `${quoteSheetName(connection.worksheet_name)}!A${input.row_number}:H${input.row_number}`,
  });
  const row = rowResponse.data.values?.[0];
  if (!row || (!row[0] && !row[1] && !row[2])) throw new Error('This student row no longer exists. Refresh the page and try again.');
  const now = new Date().toISOString();
  await client.spreadsheets.values.update({
    spreadsheetId: connection.spreadsheet_id,
    range: `${quoteSheetName(connection.worksheet_name)}!E${input.row_number}:H${input.row_number}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[input.current_status, input.status_note, now, user.email]] },
  });
  return { row_number: input.row_number, current_status: input.current_status, status_note: input.status_note, updated_at: now, updated_by: user.email };
}
