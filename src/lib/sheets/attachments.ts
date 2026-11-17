import { randomUUID } from 'crypto';
import { createAuditLog } from '@/lib/sheets/audit-log';
import { getSheetManagementSpreadsheetId, getSheetsClient } from '@/lib/sheets/client';
import type { SheetAttachmentInput, SheetDomain } from '@/lib/validators/sheet-attachment.schema';
import type { ProvisionedWorkbook } from '@/lib/google-oauth/provision-workbook';
import { placementMonthTab, scrumWeekTab, SHEET_ACCESS_MODE, SHEET_CONNECTION_STATUS, SHEET_DOMAIN, SHEET_SCOPE, SHEET_TAB } from '@/constants';

const CONNECTIONS_TAB = SHEET_TAB.REGISTRY;
const CONNECTION_HEADERS = [
  'id', 'domain', 'spreadsheet_id', 'spreadsheet_title', 'worksheet_name',
  'access_mode', 'status', 'protected_headers', 'attached_by', 'attached_at',
  'updated_at', 'active', 'batch',
];
const CONNECTION_CACHE_TTL_MS = 5 * 60 * 1000;
let connectionRowsCache: { rows: unknown[][]; expiresAt: number } | null = null;
let connectionRowsRequest: Promise<unknown[][]> | null = null;

export function invalidateSheetConnectionCache() {
  connectionRowsCache = null;
  connectionRowsRequest = null;
}

export interface SheetConnectionView {
  id: string;
  domain: SheetDomain;
  batch: string;
  spreadsheet_title: string;
  worksheet_name: string;
  access_mode: 'read_only' | 'read_write';
  status: 'connected';
  protected_headers: boolean;
  attached_by: string;
  attached_at: string;
  id_hint: string;
  spreadsheet_url: string;
}

export interface OperationalSheetConnection {
  domain: SheetDomain;
  batch: string;
  spreadsheet_id: string;
  worksheet_name: string;
  access_mode: 'read_only' | 'read_write';
}

export class SheetConnectionNotFoundError extends Error {
  constructor(domain: SheetDomain, batch: string) {
    super(`No active ${domain} spreadsheet is configured for ${batch}`);
    this.name = 'SheetConnectionNotFoundError';
  }
}

interface AttachmentActor {
  id: string;
  email: string;
  role: string;
  name: string;
}

export function extractSpreadsheetId(value: string): string {
  const input = value.trim();
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter a valid Google Sheet URL or spreadsheet ID');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    throw new Error('Only https://docs.google.com spreadsheet URLs are allowed');
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{25,})/);
  if (!match) throw new Error('The Google Sheet URL does not contain a valid spreadsheet ID');
  return match[1];
}

export function getServiceAccountEmail(): string | undefined {
  if (process.env.GOOGLE_SHEETS_PRINCIPAL_EMAIL) return process.env.GOOGLE_SHEETS_PRINCIPAL_EMAIL;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { client_email?: string };
    return parsed.client_email;
  } catch {
    return undefined;
  }
}

async function ensureConnectionsTab() {
  const client = await getSheetsClient();
  const masterId = getSheetManagementSpreadsheetId();
  const metadata = await client.spreadsheets.get({ spreadsheetId: masterId, fields: 'sheets.properties' });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === CONNECTIONS_TAB);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: masterId,
      requestBody: { requests: [{ addSheet: { properties: { title: CONNECTIONS_TAB, gridProperties: { frozenRowCount: 1 } } } }] },
    });
    await client.spreadsheets.values.update({
      spreadsheetId: masterId,
      range: `${CONNECTIONS_TAB}!A1:M1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CONNECTION_HEADERS] },
    });
    return;
  }
  const response = await client.spreadsheets.values.get({ spreadsheetId: masterId, range: `${CONNECTIONS_TAB}!A1:M1` });
  const headers = (response.data.values?.[0] ?? []).map(String);
  if (!headers.length) {
    await client.spreadsheets.values.update({
      spreadsheetId: masterId,
      range: `${CONNECTIONS_TAB}!A1:M1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CONNECTION_HEADERS] },
    });
    return;
  }
  if (CONNECTION_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error(`The ${CONNECTIONS_TAB} tab headers do not match the PlacementHQ registry schema`);
  }
}

async function readConnectionRows(): Promise<unknown[][]> {
  if (connectionRowsCache && connectionRowsCache.expiresAt > Date.now()) return connectionRowsCache.rows;
  if (connectionRowsRequest) return connectionRowsRequest;
  connectionRowsRequest = (async () => {
    const client = await getSheetsClient();
    const masterId = getSheetManagementSpreadsheetId();
    const response = await client.spreadsheets.values.get({ spreadsheetId: masterId, range: `${CONNECTIONS_TAB}!A2:M` });
    const seen = new Set<string>();
    const rows = (response.data.values ?? []).filter((row) => {
      const id = String(row[0] ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    connectionRowsCache = { rows, expiresAt: Date.now() + CONNECTION_CACHE_TTL_MS };
    return rows;
  })();
  try {
    return await connectionRowsRequest;
  } finally {
    connectionRowsRequest = null;
  }
}

export async function listSheetConnections(): Promise<SheetConnectionView[]> {
  const rows = await readConnectionRows();
  const seenSpreadsheets = new Set<string>();
  return rows
    .filter((row) => row[0] && row[11] !== 'false')
    .reverse()
    .filter((row) => { const spreadsheetId = String(row[2] ?? ''); if (!spreadsheetId || seenSpreadsheets.has(spreadsheetId)) return false; seenSpreadsheets.add(spreadsheetId); return true; })
    .map<SheetConnectionView>((row) => ({
      id: String(row[0]),
      domain: row[1] as SheetDomain,
      batch: String(row[12] || 'GLOBAL'),
      spreadsheet_title: String(row[3] ?? 'Untitled spreadsheet'),
      worksheet_name: String(row[4] ?? ''),
      access_mode: row[5] === 'read_write' ? 'read_write' : 'read_only',
      status: 'connected' as const,
      protected_headers: row[7] === 'true',
      attached_by: String(row[8] ?? ''),
      attached_at: String(row[9] ?? ''),
      id_hint: `••••${String(row[2] ?? '').slice(-6)}`,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${String(row[2] ?? '')}/edit`,
    }));
}

export async function listOperationalSheetConnections(domain: SheetDomain): Promise<OperationalSheetConnection[]> {
  const rows = await readConnectionRows();
  return rows
    .filter((row) => row[1] === domain && row[6] === 'connected' && row[11] !== 'false')
    .map((row) => ({
      domain,
      batch: String(row[12] || 'GLOBAL').toUpperCase(),
      spreadsheet_id: String(row[2]),
      worksheet_name: String(row[4]),
      access_mode: row[5] === 'read_write' ? 'read_write' : 'read_only',
    }));
}

export async function getOperationalSheetConnection(domain: SheetDomain, batch: string): Promise<OperationalSheetConnection> {
  const rows = await readConnectionRows();
  const normalizedBatch = batch.trim().toUpperCase();
  const row = [...rows].reverse().find((candidate) => (
    candidate[1] === domain
    && String(candidate[12] || 'GLOBAL').toUpperCase() === normalizedBatch
    && candidate[6] === 'connected'
    && candidate[11] !== 'false'
  ));
  if (!row) throw new SheetConnectionNotFoundError(domain, normalizedBatch);
  return {
    domain,
    batch: normalizedBatch,
    spreadsheet_id: String(row[2]),
    worksheet_name: String(row[4]),
    access_mode: row[5] === 'read_write' ? 'read_write' : 'read_only',
  };
}

export async function registerProvisionedWorkbook(workbook: ProvisionedWorkbook, actor: AttachmentActor): Promise<SheetConnectionView | SheetConnectionView[]> {
  await ensureConnectionsTab();
  const now = new Date().toISOString();
  const registrations: Array<{ id: string; domain: SheetDomain; worksheetName: string; scope: string }> = workbook.template === 'performance_management'
    ? [
        { id: randomUUID(), domain: SHEET_DOMAIN.WEEKLY_KPIS, worksheetName: SHEET_TAB.WEEKLY_GOALS, scope: SHEET_SCOPE.GLOBAL },
        { id: randomUUID(), domain: SHEET_DOMAIN.MONTHLY_KPIS, worksheetName: SHEET_TAB.PERFORMANCE_PLANS, scope: SHEET_SCOPE.GLOBAL },
        { id: randomUUID(), domain: SHEET_DOMAIN.QUARTERLY_OKRS, worksheetName: SHEET_TAB.PERFORMANCE_PLANS, scope: SHEET_SCOPE.GLOBAL },
      ]
    : [{
        id: randomUUID(),
        domain: workbook.template === 'central_system' ? SHEET_DOMAIN.CENTRAL_SYSTEM : workbook.template === 'scrum_management' ? SHEET_DOMAIN.SCRUM_UPDATES : SHEET_DOMAIN.PLACEMENTS,
        worksheetName: workbook.template === 'central_system' ? SHEET_TAB.REGISTRY : workbook.template === 'scrum_management' ? scrumWeekTab(workbook.year!, '01') : placementMonthTab(workbook.year!, '01'),
        scope: workbook.template === 'central_system' ? SHEET_SCOPE.GLOBAL : String(workbook.year),
      }];
  const client = await getSheetsClient();
  await client.spreadsheets.values.append({
    spreadsheetId: getSheetManagementSpreadsheetId(),
    range: `${CONNECTIONS_TAB}!A:M`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: registrations.map(({ id, domain, worksheetName, scope }) => [id, domain, workbook.spreadsheetId, workbook.title, worksheetName, SHEET_ACCESS_MODE.READ_WRITE, SHEET_CONNECTION_STATUS.CONNECTED, 'true', actor.email, now, now, 'true', scope]),
    },
  });
  invalidateSheetConnectionCache();

  await Promise.all(registrations.map(async ({ id, worksheetName }) => {
    try {
      await createAuditLog({ actor_id: actor.id, actor_email: actor.email, actor_role: actor.role, action: 'sheet.provisioned.registered', target_type: 'spreadsheet', target_id: id, metadata: JSON.stringify({ template: workbook.template, worksheet: worksheetName, spreadsheet_id_hint: workbook.spreadsheetId.slice(-6) }), ip_address: '', user_agent: '' });
    } catch (error) {
      console.error('Failed to record provisioned workbook audit log', error);
    }
  }));

  const views = registrations.map(({ id, domain, worksheetName, scope }) => ({ id, domain, batch: scope, spreadsheet_title: workbook.title, worksheet_name: worksheetName, access_mode: SHEET_ACCESS_MODE.READ_WRITE, status: SHEET_CONNECTION_STATUS.CONNECTED, protected_headers: true, attached_by: actor.email, attached_at: now, id_hint: `••••${workbook.spreadsheetId.slice(-6)}`, spreadsheet_url: workbook.spreadsheetUrl } satisfies SheetConnectionView));
  return views.length === 1 ? views[0] : views;
}

export async function ensureSheetRegistryEntry(input: {
  domain: SheetDomain;
  spreadsheetId: string;
  spreadsheetTitle: string;
  worksheetName: string;
  actor: AttachmentActor;
  batch?: string;
}): Promise<void> {
  const batch = (input.batch || SHEET_SCOPE.GLOBAL).trim().toUpperCase();
  await ensureConnectionsTab();
  const rows = await readConnectionRows();
  const exists = rows.some((row) => (
    String(row[1] ?? '') === input.domain
    && String(row[2] ?? '') === input.spreadsheetId
    && String(row[4] ?? '') === input.worksheetName
    && String(row[12] || SHEET_SCOPE.GLOBAL).toUpperCase() === batch
    && String(row[11] ?? 'true') !== 'false'
  ));
  if (exists) return;

  const now = new Date().toISOString();
  const client = await getSheetsClient();
  await client.spreadsheets.values.append({
    spreadsheetId: getSheetManagementSpreadsheetId(),
    range: `${CONNECTIONS_TAB}!A:M`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[randomUUID(), input.domain, input.spreadsheetId, input.spreadsheetTitle, input.worksheetName, SHEET_ACCESS_MODE.READ_WRITE, SHEET_CONNECTION_STATUS.CONNECTED, 'true', input.actor.email, now, now, 'true', batch]] },
  });
  invalidateSheetConnectionCache();
}

export async function attachGoogleSheet(input: SheetAttachmentInput, actor: AttachmentActor): Promise<SheetConnectionView> {
  const spreadsheetId = extractSpreadsheetId(input.sheet_url);
  const client = await getSheetsClient();
  const metadata = await client.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'spreadsheetId,properties.title,sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description,warningOnly))',
  });
  const worksheets = metadata.data.sheets ?? [];
  if (worksheets.length === 0) throw new Error('The spreadsheet has no worksheets');
  const worksheet = input.worksheet_name
    ? worksheets.find((sheet) => sheet.properties?.title === input.worksheet_name)
    : worksheets[0];
  if (worksheet?.properties?.sheetId == null || !worksheet.properties.title) {
    throw new Error(input.worksheet_name ? `Worksheet “${input.worksheet_name}” was not found` : 'Unable to read the first worksheet');
  }

  let protectedHeaders = false;
  if (input.protect_headers) {
    const protectionDescription = 'JP Dashboard managed header protection';
    const alreadyProtected = worksheet.protectedRanges?.some((range) => range.description === protectionDescription);
    if (!alreadyProtected) {
      const sheetsPrincipalEmail = getServiceAccountEmail();
      if (!sheetsPrincipalEmail) throw new Error('The Google Sheets principal email could not be determined');
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addProtectedRange: {
              protectedRange: {
                description: protectionDescription,
                warningOnly: false,
                range: { sheetId: worksheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                editors: { users: [sheetsPrincipalEmail] },
              },
            },
          }],
        },
      });
    }
    protectedHeaders = true;
  }

  await ensureConnectionsTab();
  const now = new Date().toISOString();
  const id = randomUUID();
  await client.spreadsheets.values.append({
    spreadsheetId: getSheetManagementSpreadsheetId(),
    range: `${CONNECTIONS_TAB}!A:M`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[id, input.domain, spreadsheetId, metadata.data.properties?.title ?? 'Untitled spreadsheet', worksheet.properties.title, input.access_mode, 'connected', String(protectedHeaders), actor.email, now, now, 'true', input.batch]] },
  });
  invalidateSheetConnectionCache();

  try {
    await createAuditLog({ actor_id: actor.id, actor_email: actor.email, actor_role: actor.role, action: 'sheet.connection.created', target_type: 'spreadsheet', target_id: id, metadata: JSON.stringify({ domain: input.domain, batch: input.batch, worksheet: worksheet.properties.title, access_mode: input.access_mode, protected_headers: protectedHeaders, spreadsheet_id_hint: spreadsheetId.slice(-6) }), ip_address: '', user_agent: '' });
  } catch (error) {
    console.error('Failed to record sheet attachment audit log', error);
  }

  return { id, domain: input.domain, batch: input.batch, spreadsheet_title: metadata.data.properties?.title ?? 'Untitled spreadsheet', worksheet_name: worksheet.properties.title, access_mode: input.access_mode, status: 'connected', protected_headers: protectedHeaders, attached_by: actor.email, attached_at: now, id_hint: `••••${spreadsheetId.slice(-6)}`, spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}
