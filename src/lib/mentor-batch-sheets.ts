import { MENTOR_STUDENT_STATUSES, SHEET_TAB, type MentorStudentStatus } from '@/constants';
import { getAuthUserById, type AuthUser } from '@/lib/auth/users';
import { extractSpreadsheetId } from '@/lib/sheets/attachments';
import { getSheetManagementSpreadsheetId, getSheetsClient } from '@/lib/sheets/client';
import type { JWTPayload } from '@/types';
import type { MentorStudentSheetAttachmentInput, MentorStudentStatusUpdateInput } from '@/lib/validators/mentor-student-sheet.schema';

const REGISTRY_TAB = SHEET_TAB.MENTOR_BATCHES;
const REGISTRY_HEADERS = [
  'worksheet_name', 'mentor_name', 'discord_username', 'discord_id', 'batch',
  'level', 'is_active', 'sheet_id_or_link', 'added_date', 'duration',
] as const;
const STUDENT_HEADERS = ['student_name', 'email', 'phone', 'batch', 'status', 'notes'] as const;
const HEADER_ALIASES: Record<(typeof STUDENT_HEADERS)[number], string[]> = {
  student_name: ['student_name', 'student', 'name'],
  email: ['email', 'student_email'],
  phone: ['phone', 'phone_number', 'mobile', 'mobile_number'],
  batch: ['batch', 'batch_name'],
  status: ['status', 'current_status'],
  notes: ['notes', 'note', 'status_note'],
};

export interface MentorStudentSheetConnection {
  id: string;
  mentor_name: string;
  discord_username: string;
  discord_user_id: string;
  batch: string;
  level: 'Level-1' | 'Level-2';
  duration_months: number;
  spreadsheet_title: string;
  worksheet_name: string;
  spreadsheet_url: string;
  source_sheet_url: string;
  attached_at: string;
  updated_at: string;
  status: 'connected';
}

export interface MentorStudentRow {
  row_number: number;
  student_name: string;
  student_email: string;
  phone: string;
  batch: string;
  current_status: string;
  status_note: string;
  updated_at: string;
  updated_by: string;
}

interface StoredConnection extends MentorStudentSheetConnection { active: boolean }

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function registryRowToConnection(row: unknown[], rowNumber: number): StoredConnection {
  const managementId = getSheetManagementSpreadsheetId();
  const worksheetName = String(row[0] ?? '');
  return {
    id: `batchs-${rowNumber}`,
    worksheet_name: worksheetName,
    mentor_name: String(row[1] ?? ''),
    discord_username: String(row[2] ?? ''),
    discord_user_id: String(row[3] ?? ''),
    batch: String(row[4] ?? ''),
    level: String(row[5] ?? 'Level-1') === 'Level-2' ? 'Level-2' : 'Level-1',
    active: String(row[6] ?? 'true').toLowerCase() !== 'false',
    source_sheet_url: String(row[7] ?? ''),
    attached_at: String(row[8] ?? ''),
    updated_at: String(row[8] ?? ''),
    duration_months: Math.min(6, Math.max(1, Number.parseInt(String(row[9] ?? '1'), 10) || 1)),
    spreadsheet_title: 'Placement DBMS',
    spreadsheet_url: `https://docs.google.com/spreadsheets/d/${managementId}/edit`,
    status: 'connected',
  };
}

async function ensureRegistryTab() {
  const client = await getSheetsClient();
  const spreadsheetId = getSheetManagementSpreadsheetId();
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === REGISTRY_TAB);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: REGISTRY_TAB, gridProperties: { frozenRowCount: 1, columnCount: REGISTRY_HEADERS.length } } } }] },
    });
  }
  const headerResponse = await client.spreadsheets.values.get({ spreadsheetId, range: `${quoteSheetName(REGISTRY_TAB)}!A1:J1` });
  const headers = (headerResponse.data.values?.[0] ?? []).map(String);
  if (!headers.length) {
    await client.spreadsheets.values.update({ spreadsheetId, range: `${quoteSheetName(REGISTRY_TAB)}!A1:J1`, valueInputOption: 'RAW', requestBody: { values: [[...REGISTRY_HEADERS]] } });
  } else if (REGISTRY_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error(`The ${REGISTRY_TAB} tab headers do not match the PlacementHQ mentor batch schema. See workspace/mentor.md before changing this tab.`);
  }
}

async function readRegistryRows() {
  await ensureRegistryTab();
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({ spreadsheetId: getSheetManagementSpreadsheetId(), range: `${quoteSheetName(REGISTRY_TAB)}!A2:J` });
  return response.data.values ?? [];
}

async function getMentorIdentity(user: JWTPayload): Promise<AuthUser> {
  const profile = await getAuthUserById(user.id);
  if (!profile) throw new Error('Your login account could not be matched with the central users sheet.');
  if (!profile.discord_user_id || !profile.discord_username) throw new Error('Ask an admin to add your Discord username and Discord user ID before importing a mentee sheet.');
  return profile;
}

async function getMentorConnection(user: JWTPayload): Promise<StoredConnection | null> {
  const profile = await getMentorIdentity(user);
  const rows = await readRegistryRows();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const connection = registryRowToConnection(rows[index], index + 2);
    if (connection.active && connection.discord_user_id === profile.discord_user_id) return connection;
  }
  return null;
}

function publicConnection(connection: StoredConnection): MentorStudentSheetConnection {
  const { active: _active, ...value } = connection;
  return value;
}

async function readStudents(connection: StoredConnection): Promise<MentorStudentRow[]> {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({ spreadsheetId: getSheetManagementSpreadsheetId(), range: `${quoteSheetName(connection.worksheet_name)}!A2:F` });
  return (response.data.values ?? []).map((row, index) => ({
    row_number: index + 2,
    student_name: String(row[0] ?? ''), student_email: String(row[1] ?? ''), phone: String(row[2] ?? ''),
    batch: String(row[3] ?? ''), current_status: String(row[4] ?? MENTOR_STUDENT_STATUSES[0]), status_note: String(row[5] ?? ''),
    updated_at: '', updated_by: '',
  })).filter((student) => student.student_name || student.student_email || student.phone);
}

function buildImportedRows(values: unknown[][], batch: string) {
  const sourceHeaders = (values[0] ?? []).map(normalizeHeader);
  const indexes = Object.fromEntries(STUDENT_HEADERS.map((header) => [header, sourceHeaders.findIndex((candidate) => HEADER_ALIASES[header].includes(candidate))])) as Record<(typeof STUDENT_HEADERS)[number], number>;
  const missing = STUDENT_HEADERS.filter((header) => indexes[header] === -1);
  if (missing.length) throw new Error(`The source worksheet is missing required columns: ${missing.join(', ')}`);

  return values.slice(1).map((row, rowIndex) => {
    const rawStatus = String(row[indexes.status] ?? '').trim();
    const status = rawStatus || MENTOR_STUDENT_STATUSES[0];
    if (!MENTOR_STUDENT_STATUSES.includes(status as MentorStudentStatus)) throw new Error(`Row ${rowIndex + 2} has unsupported status “${status}”. Use one of the documented mentor statuses.`);
    return [String(row[indexes.student_name] ?? '').trim(), String(row[indexes.email] ?? '').trim(), String(row[indexes.phone] ?? '').trim(), batch, status, String(row[indexes.notes] ?? '').trim()];
  }).filter((row) => row[0] || row[1] || row[2]);
}

function uniqueWorksheetName(requestedName: string, existingNames: Set<string>) {
  const base = requestedName.replace(/[\\/?*\[\]:]/g, '-').trim().slice(0, 90) || 'Mentees';
  if (!existingNames.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, 95 - String(suffix).length)} (${suffix})`;
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Unable to allocate a unique worksheet name in Placement DBMS.');
}

export async function getMentorStudentWorkspace(user: JWTPayload) {
  const connection = await getMentorConnection(user);
  if (!connection) return { connection: null, students: [] as MentorStudentRow[] };
  return { connection: publicConnection(connection), students: await readStudents(connection) };
}

export async function listMentorStudentSheetConnections(): Promise<MentorStudentSheetConnection[]> {
  const rows = await readRegistryRows();
  const seen = new Set<string>();
  return rows.map((row, index) => registryRowToConnection(row, index + 2)).reverse().filter((connection) => {
    if (!connection.active || seen.has(connection.discord_user_id)) return false;
    seen.add(connection.discord_user_id);
    return true;
  }).map(publicConnection);
}

export async function attachMentorStudentSheet(user: JWTPayload, input: MentorStudentSheetAttachmentInput) {
  const profile = await getMentorIdentity(user);
  const sourceSpreadsheetId = extractSpreadsheetId(input.sheet_url);
  const client = await getSheetsClient();
  let sourceMetadata;
  try {
    sourceMetadata = await client.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId, fields: 'spreadsheetId,properties.title,sheets.properties.title' });
  } catch {
    throw new Error('The source sheet could not be read. Set General access to “Anyone with the link — Viewer” and try again.');
  }
  const sourceWorksheet = sourceMetadata.data.sheets?.find((sheet) => sheet.properties?.title === input.worksheet_name);
  if (!sourceWorksheet) throw new Error(`Worksheet “${input.worksheet_name}” was not found in the source spreadsheet.`);
  const sourceValues = await client.spreadsheets.values.get({ spreadsheetId: sourceSpreadsheetId, range: `${quoteSheetName(input.worksheet_name)}!A:Z` });
  const importedRows = buildImportedRows(sourceValues.data.values ?? [], input.batch);
  if (!importedRows.length) throw new Error('The source worksheet does not contain any mentee rows.');

  await ensureRegistryTab();
  const managementId = getSheetManagementSpreadsheetId();
  const managementMetadata = await client.spreadsheets.get({ spreadsheetId: managementId, fields: 'sheets.properties(title,sheetId)' });
  const existingNames = new Set((managementMetadata.data.sheets ?? []).map((sheet) => String(sheet.properties?.title ?? '').toLowerCase()));
  const destinationName = uniqueWorksheetName(input.worksheet_name, existingNames);
  await client.spreadsheets.batchUpdate({ spreadsheetId: managementId, requestBody: { requests: [{ addSheet: { properties: { title: destinationName, gridProperties: { rowCount: Math.max(1000, importedRows.length + 1), columnCount: STUDENT_HEADERS.length, frozenRowCount: 1 } } } }] } });
  await client.spreadsheets.values.update({ spreadsheetId: managementId, range: `${quoteSheetName(destinationName)}!A1:F${importedRows.length + 1}`, valueInputOption: 'RAW', requestBody: { values: [[...STUDENT_HEADERS], ...importedRows] } });
  const createdMetadata = await client.spreadsheets.get({ spreadsheetId: managementId, fields: 'sheets.properties(title,sheetId)' });
  const createdSheetId = createdMetadata.data.sheets?.find((sheet) => sheet.properties?.title === destinationName)?.properties?.sheetId;
  if (createdSheetId !== undefined && createdSheetId !== null) {
    await client.spreadsheets.batchUpdate({ spreadsheetId: managementId, requestBody: { requests: [{ setDataValidation: { range: { sheetId: createdSheetId, startRowIndex: 1, endRowIndex: Math.max(1000, importedRows.length + 1), startColumnIndex: 4, endColumnIndex: 5 }, rule: { condition: { type: 'ONE_OF_LIST', values: MENTOR_STUDENT_STATUSES.map((value) => ({ userEnteredValue: value })) }, strict: true, showCustomUi: true } } }] } });
  }

  const registryRows = await readRegistryRows();
  await Promise.all(registryRows.map(async (row, index) => {
    if (String(row[3] ?? '').trim() === profile.discord_user_id && String(row[6] ?? 'true').toLowerCase() !== 'false') {
      await client.spreadsheets.values.update({ spreadsheetId: managementId, range: `${quoteSheetName(REGISTRY_TAB)}!G${index + 2}`, valueInputOption: 'RAW', requestBody: { values: [['false']] } });
    }
  }));
  const now = new Date().toISOString();
  const registryRow = [destinationName, user.name, profile.discord_username, profile.discord_user_id, input.batch, input.level, 'true', input.sheet_url, now, input.duration_months];
  await client.spreadsheets.values.append({ spreadsheetId: managementId, range: `${quoteSheetName(REGISTRY_TAB)}!A:J`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [registryRow] } });
  return publicConnection(registryRowToConnection(registryRow, registryRows.length + 2));
}

export async function updateMentorStudentStatus(user: JWTPayload, input: MentorStudentStatusUpdateInput) {
  const connection = await getMentorConnection(user);
  if (!connection) throw new Error('Import your mentee Google Sheet first.');
  const client = await getSheetsClient();
  const rowResponse = await client.spreadsheets.values.get({ spreadsheetId: getSheetManagementSpreadsheetId(), range: `${quoteSheetName(connection.worksheet_name)}!A${input.row_number}:F${input.row_number}` });
  const row = rowResponse.data.values?.[0];
  if (!row || (!row[0] && !row[1] && !row[2])) throw new Error('This mentee row no longer exists. Refresh the page and try again.');
  await client.spreadsheets.values.update({ spreadsheetId: getSheetManagementSpreadsheetId(), range: `${quoteSheetName(connection.worksheet_name)}!E${input.row_number}:F${input.row_number}`, valueInputOption: 'RAW', requestBody: { values: [[input.current_status, input.status_note]] } });
  return { row_number: input.row_number, current_status: input.current_status, status_note: input.status_note, updated_at: '', updated_by: user.email };
}
