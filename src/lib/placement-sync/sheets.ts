import 'server-only';

import { randomUUID } from 'node:crypto';
import type { sheets_v4 } from 'googleapis';
import { PLACEMENT_SYNC_LOG_HEADERS, PLACEMENT_WORKBOOK_HEADERS } from '@/lib/google-oauth/workbook-templates';
import { getSheetManagementSpreadsheetId, getSheetsClient } from '@/lib/sheets/client';
import { hasAppsScriptSheetsGateway, syncPlacementPageWithAppsScript } from '@/lib/sheets/apps-script-client';
import { ensureSheetRegistryEntry, getOperationalSheetConnection, SheetConnectionNotFoundError } from '@/lib/sheets/attachments';
import { placementMonthTab, placementYearTabs, SHEET_DOMAIN, SHEET_TAB } from '@/constants';
import type { PlacementAnalyticsResponse } from '@/lib/placement-analytics/types';
import type { DiscordPlacementMessage } from '@/lib/placement-sync/discord';
import type { PlacementSyncPage, PlacementSyncRecord, PlacementSyncStatus } from '@/lib/placement-sync/types';
import type { PlacementSyncInput } from '@/lib/validators/placement-sync.schema';
import { classifyPlacement, isRehiredPlacement } from '@/lib/placement-sync/classification';

const LOG_TAB = SHEET_TAB.PLACEMENT_SYNC_LOG;
const REVIEW_FIELDS = ['mentor_email', 'verification_status', 'verified_by', 'verified_at', 'verification_notes', 'internal_notes'];
type PlacementRecord = Record<(typeof PLACEMENT_WORKBOOK_HEADERS)[number], string>;
const PLACEMENT_READ_TTL_MS = 60 * 1000;
const placementAnalyticsCache = new Map<string, { data: PlacementAnalyticsResponse; expiresAt: number }>();
const placementStatusCache = new Map<number, { data: PlacementSyncStatus; expiresAt: number }>();
const managedTabCache = new Map<string, { sheetId: number; expiresAt: number }>();

export function invalidatePlacementReadCache(year?: number) {
  if (year) {
    placementStatusCache.delete(year);
    Array.from(placementAnalyticsCache.keys()).forEach((key) => { if (key.startsWith(`${year}-`)) placementAnalyticsCache.delete(key); });
    return;
  }
  placementStatusCache.clear();
  placementAnalyticsCache.clear();
}

export class PlacementSheetsError extends Error {
  constructor(message: string, public readonly code: 'NOT_CONFIGURED' | 'NOT_READY' | 'CONFLICT' | 'GOOGLE_ERROR' = 'GOOGLE_ERROR') {
    super(message);
    this.name = 'PlacementSheetsError';
  }
}

function asText(value: unknown) {
  return String(value ?? '');
}

function columnLetter(columnNumber: number) {
  let value = columnNumber;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function quoteSheet(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

function dhakaDate(value: string | Date, format: 'month' | 'date') {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = format === 'month'
    ? { year: 'numeric', month: '2-digit', timeZone: 'Asia/Dhaka' }
    : { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Dhaka' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return format === 'month'
    ? `${valueFor('year')}-${valueFor('month')}`
    : `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
}

function placementType(record: Record<string, string>): 'fresh' | 'rehired' {
  return classifyPlacement(record.job_type, record.position, record.additional_information, record.internal_notes, record.raw_message);
}

function table(values: unknown[][], requiredHeaders?: readonly string[]) {
  const headers = (values[0] ?? []).map(asText);
  if (requiredHeaders && (headers.length < requiredHeaders.length || requiredHeaders.some((header, index) => headers[index] !== header))) {
    throw new PlacementSheetsError('A managed placement tab has incompatible headers; no data was overwritten.', 'CONFLICT');
  }
  return {
    headers,
    rows: values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, asText(row[index])]))),
  };
}

async function readValues(spreadsheetId: string, range: string, options: Partial<sheets_v4.Params$Resource$Spreadsheets$Values$Get> = {}) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range, ...options });
  return response.data.values ?? [];
}

export async function getPlacementSpreadsheetId(year = new Date().getFullYear()) {
  try {
    return (await getOperationalSheetConnection(SHEET_DOMAIN.PLACEMENTS, String(year))).spreadsheet_id;
  } catch (error) {
    if (!(error instanceof SheetConnectionNotFoundError)) throw error;
  }
  return process.env.GOOGLE_PLACEMENT_SPREADSHEET_ID?.trim() || null;
}

async function requiredPlacementSpreadsheetId(year: number) {
  const id = await getPlacementSpreadsheetId(year);
  if (!id) {
    throw new PlacementSheetsError(`Assign an active ${SHEET_DOMAIN.PLACEMENTS} workbook to year ${year} in Sheet Management.`, 'NOT_CONFIGURED');
  }
  return id;
}

function isMissingWorksheetError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unable to parse range|range not found|sheet.*not found|worksheet.*not found/i.test(message);
}

async function ensureManagedTab(spreadsheetId: string, title: string, headers: readonly string[]) {
  const cacheKey = `${spreadsheetId}:${title}`;
  const cached = managedTabCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.sheetId;
  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title),protectedRanges(description))' });
  const cacheExpiresAt = Date.now() + 10 * 60 * 1000;
  metadata.data.sheets?.forEach((entry) => {
    const existingTitle = entry.properties?.title;
    const existingSheetId = entry.properties?.sheetId;
    if (existingTitle && existingSheetId !== undefined && existingSheetId !== null) {
      managedTabCache.set(`${spreadsheetId}:${existingTitle}`, { sheetId: existingSheetId, expiresAt: cacheExpiresAt });
    }
  });
  let worksheet = metadata.data.sheets?.find((entry) => entry.properties?.title === title);
  const worksheetExisted = Boolean(worksheet);
  if (!worksheet) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 8), frozenRowCount: 1 } } } }] },
    });
    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    worksheet = { properties: { sheetId, title } };
  }
  const sheetId = worksheet.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new PlacementSheetsError(`Google did not return the worksheet ID for ${title}.`);
  if (worksheetExisted) {
    managedTabCache.set(cacheKey, { sheetId, expiresAt: cacheExpiresAt });
    return sheetId;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheet(title)}!A1:${columnLetter(headers.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array.from(headers)] },
  });

  if (!worksheet.protectedRanges?.some((range) => range.description === 'PlacementHQ managed header row')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.12, green: 0.18, blue: 0.5 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat' } },
        { addProtectedRange: { protectedRange: { description: 'PlacementHQ managed header row', warningOnly: true, range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length } } } },
      ] },
    });
  }
  managedTabCache.set(cacheKey, { sheetId, expiresAt: cacheExpiresAt });
  return sheetId;
}

export async function setupPlacementWorkbook(year: number, actor?: { id: string; email: string; role: string; name: string }): Promise<PlacementSyncStatus> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new PlacementSheetsError('Select a valid placement year.', 'CONFLICT');
  const spreadsheetId = await requiredPlacementSpreadsheetId(year);
  for (const monthTab of placementYearTabs(year)) {
    await ensureManagedTab(spreadsheetId, monthTab, PLACEMENT_WORKBOOK_HEADERS);
  }
  await ensureManagedTab(spreadsheetId, LOG_TAB, PLACEMENT_SYNC_LOG_HEADERS);
  if (actor) {
    const sheets = await getSheetsClient();
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title' });
    await ensureSheetRegistryEntry({
      domain: SHEET_DOMAIN.PLACEMENTS,
      spreadsheetId,
      spreadsheetTitle: metadata.data.properties?.title ?? 'Placement Management',
      worksheetName: placementMonthTab(year, '01'),
      actor,
      batch: String(year),
    });
  }
  invalidatePlacementReadCache(year);
  return getPlacementStatus(year);
}

function emptyRecord(): PlacementRecord {
  return Object.fromEntries(PLACEMENT_WORKBOOK_HEADERS.map((header) => [header, ''])) as PlacementRecord;
}

export function parsePlacementMessage(message: DiscordPlacementMessage, guildId: string, channelId: string): PlacementRecord | null {
  const aliases: Record<string, keyof PlacementRecord> = {
    candidatename: 'candidate_name', studentname: 'candidate_name', name: 'candidate_name',
    email: 'candidate_email', studentemail: 'candidate_email', candidateemail: 'candidate_email',
    phone: 'phone', phonenumber: 'phone', mobile: 'phone', company: 'company_name', companyname: 'company_name',
    location: 'location', position: 'position', designation: 'position', role: 'position', jobtype: 'job_type',
    employmenttype: 'job_type', placementtype: 'job_type', hiringtype: 'job_type', fresherorcareerupgraded: 'job_type',
    fresherorcareerupgradation: 'job_type', careerupgraded: 'job_type', careerupgradation: 'job_type',
    batch: 'batch', batchname: 'batch', studentbatch: 'batch', course: 'course',
    projectname: 'project_name', project: 'project_name', placementdate: 'placement_date', placeddate: 'placement_date',
  };
  const original = message.content || '';
  const fields: Partial<PlacementRecord> = {};
  const extra: Record<string, unknown> = {};
  const evidence: string[] = [];
  const issues: string[] = [];
  const lines = original.split(/\r?\n/);
  message.embeds.forEach((embed) => {
    if (embed.description) lines.push(...embed.description.split(/\r?\n/));
    embed.fields?.forEach((field) => lines.push(`${field.name}: ${field.value}`));
  });
  lines.forEach((line) => {
    const cleaned = line.replace(/\*\*/g, '').replace(/^\s*[-*•]\s*/, '').trim();
    if (!cleaned || /^@(everyone|here)$/i.test(cleaned)) return;
    const match = cleaned.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match) {
      if (/verified by|confirmation message/i.test(cleaned)) evidence.push(cleaned);
      else extra.notes = extra.notes ? `${extra.notes}\n${cleaned}` : cleaned;
      return;
    }
    const label = match[1].trim();
    const field = aliases[label.toLowerCase().replace(/[^a-z0-9]/g, '')];
    const value = match[2].trim();
    if (field) {
      if (fields[field] && fields[field] !== value) issues.push(`Multiple values for ${field}; review the message.`);
      else fields[field] = value;
    } else extra[label] = value;
  });
  if (!fields.candidate_name && !fields.candidate_email && !fields.company_name) return null;
  fields.candidate_email = asText(fields.candidate_email).replace(/\\@/g, '@').toLowerCase();
  (['candidate_name', 'candidate_email', 'company_name', 'batch'] as const).forEach((field) => {
    if (!fields[field]) issues.push(`Missing ${field}`);
  });
  if (fields.candidate_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.candidate_email)) issues.push('Invalid candidate_email');
  if (message.attachments.length) extra.attachments = message.attachments.map(({ filename, url }) => ({ filename, url }));
  const record = Object.assign(emptyRecord(), fields);
  record.discord_message_id = message.id;
  record.posted_at = message.timestamp;
  record.edited_at = message.edited_timestamp || '';
  record.month_key = dhakaDate(message.timestamp, 'month');
  record.mentor_discord_id = message.author.id;
  record.mentor_name = message.member?.nick || message.author.global_name || message.author.username;
  record.verification_status = 'pending';
  record.verification_evidence = evidence.join('\n');
  record.additional_information = Object.keys(extra).length ? JSON.stringify(extra) : '';
  record.discord_message_url = `https://discord.com/channels/${guildId}/${channelId}/${message.id}`;
  record.raw_message = original || JSON.stringify(message.embeds);
  if (isRehiredPlacement(record.job_type, record.position, record.additional_information, record.raw_message)) record.job_type = 'Rehired';
  record.parse_status = issues.length ? 'needs_review' : 'valid';
  record.parse_errors = issues.join('; ');
  record.synced_at = new Date().toISOString();
  return record;
}

export function mergePlacementRecord(incoming: PlacementRecord, existing?: Record<string, string>) {
  const merged = { ...(existing ?? {}), ...incoming } as PlacementRecord;
  if (existing) REVIEW_FIELDS.forEach((field) => {
    if (existing[field]) merged[field as keyof PlacementRecord] = existing[field];
  });
  return merged;
}

async function writePlacementRecords(spreadsheetId: string, tabName: string, incoming: PlacementRecord[]) {
  const values = await readValues(spreadsheetId, `${quoteSheet(tabName)}!A:AD`);
  const current = table(values, PLACEMENT_WORKBOOK_HEADERS);
  const indexById = new Map<string, number>();
  current.rows.forEach((row, index) => {
    if (!row.discord_message_id) return;
    if (indexById.has(row.discord_message_id)) throw new PlacementSheetsError(`Duplicate Discord message IDs exist in ${tabName}.`, 'CONFLICT');
    indexById.set(row.discord_message_id, index);
  });
  const counters = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  const updates: Array<{ range: string; values: string[][] }> = [];
  const additions: string[][] = [];
  incoming.forEach((record) => {
    if (record.parse_status !== 'valid') counters.invalid += 1;
    const existingIndex = indexById.get(record.discord_message_id);
    const existing = existingIndex === undefined ? undefined : current.rows[existingIndex];
    const merged = mergePlacementRecord(record, existing);
    const row = PLACEMENT_WORKBOOK_HEADERS.map((header) => merged[header] ?? '');
    if (existingIndex === undefined) {
      additions.push(row);
      indexById.set(record.discord_message_id, current.rows.length + additions.length - 1);
      counters.inserted += 1;
    } else if (PLACEMENT_WORKBOOK_HEADERS.every((header) => header === 'synced_at' || asText(existing?.[header]) === merged[header])) {
      counters.unchanged += 1;
    } else {
      const sheetRow = existingIndex + 2;
      updates.push({ range: `${quoteSheet(tabName)}!A${sheetRow}:AD${sheetRow}`, values: [row] });
      counters.updated += 1;
    }
  });
  const sheets = await getSheetsClient();
  if (additions.length) {
    const firstRow = Math.max(2, values.length + 1);
    const lastRow = firstRow + additions.length - 1;
    updates.push({ range: `${quoteSheet(tabName)}!A${firstRow}:AD${lastRow}`, values: additions });
  }
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: updates } });
  }
  return counters;
}

async function appendSyncLog(spreadsheetId: string, actorEmail: string, input: PlacementSyncInput, cursor: string, result: Partial<PlacementSyncPage>, startedAt: string, error = '') {
  const row = placementSyncLog(input, actorEmail, cursor, result, startedAt, error);
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${LOG_TAB}!A:Q`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [PLACEMENT_SYNC_LOG_HEADERS.map((header) => row[header] ?? '')] },
  });
}

function placementSyncLog(input: PlacementSyncInput, actorEmail: string, cursor: string, result: Partial<PlacementSyncPage>, startedAt: string, error = '') {
  return {
    id: randomUUID(), run_id: input.runId, from_date: input.fromDate, to_date: input.toDate, cursor,
    actor_email: actorEmail, fetched: result.fetched ?? 0, inserted: result.inserted ?? 0, updated: result.updated ?? 0,
    unchanged: result.unchanged ?? 0, invalid: result.invalid ?? 0, ignored: result.ignored ?? 0,
    next_cursor: result.nextCursor ?? '', status: error ? 'failed' : result.complete ? 'completed' : 'page_saved', error,
    started_at: startedAt, completed_at: new Date().toISOString(),
  };
}

function snowflake(time: number) {
  return (BigInt(Math.max(0, time - 1420070400000)) << BigInt(22)).toString();
}

export async function ingestPlacementPage(input: PlacementSyncInput, actorEmail: string, source: { channelId: string; guildId: string; messages: DiscordPlacementMessage[] }): Promise<PlacementSyncPage> {
  const year = Number(input.fromDate.slice(0, 4));
  const startedAt = new Date().toISOString();
  const start = Date.parse(`${input.fromDate}T00:00:00+06:00`);
  const end = Date.parse(`${input.toDate}T00:00:00+06:00`) + 86400000;
  const cursor = input.cursor ?? snowflake(end);
  const seen = new Set<string>();
  const selected = source.messages.filter((message) => {
    const timestamp = Date.parse(message.timestamp);
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return timestamp >= start && timestamp < end;
  });
  const records = selected.flatMap((message) => {
    if (message.author.bot) return [];
    const parsed = parsePlacementMessage(message, source.guildId, source.channelId);
    return parsed ? [parsed] : [];
  });
  const oldest = source.messages.reduce<DiscordPlacementMessage | null>((current, message) => !current || BigInt(message.id) < BigInt(current.id) ? message : current, null);
  const complete = source.messages.length < 100 || !oldest || Date.parse(oldest.timestamp) < start || BigInt(oldest.id) <= BigInt(snowflake(start));
  const page = {
    runId: input.runId,
    fetched: selected.length,
    ignored: selected.length - records.length,
    nextCursor: complete ? null : oldest?.id ?? null,
    complete,
  };
  if (hasAppsScriptSheetsGateway()) {
    const counters = await syncPlacementPageWithAppsScript({
      centralSpreadsheetId: getSheetManagementSpreadsheetId(),
      year,
      placementHeaders: PLACEMENT_WORKBOOK_HEADERS,
      logHeaders: PLACEMENT_SYNC_LOG_HEADERS,
      records,
      log: placementSyncLog(input, actorEmail, cursor, page, startedAt),
    });
    invalidatePlacementReadCache(year);
    return { ...page, ...counters };
  }
  const spreadsheetId = await requiredPlacementSpreadsheetId(year);
  const grouped = new Map<string, PlacementRecord[]>();
  records.forEach((record) => {
    const [recordYear, recordMonth] = record.month_key.split('-');
    const tabName = placementMonthTab(recordYear, recordMonth);
    grouped.set(tabName, [...(grouped.get(tabName) ?? []), record]);
  });
  const counters = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  for (const [tabName, monthRecords] of Array.from(grouped.entries())) {
    let monthCounters;
    try {
      monthCounters = await writePlacementRecords(spreadsheetId, tabName, monthRecords);
    } catch (error) {
      if (!isMissingWorksheetError(error)) throw error;
      await ensureManagedTab(spreadsheetId, tabName, PLACEMENT_WORKBOOK_HEADERS);
      monthCounters = await writePlacementRecords(spreadsheetId, tabName, monthRecords);
    }
    counters.inserted += monthCounters.inserted;
    counters.updated += monthCounters.updated;
    counters.unchanged += monthCounters.unchanged;
    counters.invalid += monthCounters.invalid;
  }
  const result: PlacementSyncPage = { ...page, ...counters };
  try {
    await appendSyncLog(spreadsheetId, actorEmail, input, cursor, result, startedAt);
  } catch (error) {
    if (!isMissingWorksheetError(error)) throw error;
    await ensureManagedTab(spreadsheetId, LOG_TAB, PLACEMENT_SYNC_LOG_HEADERS);
    await appendSyncLog(spreadsheetId, actorEmail, input, cursor, result, startedAt);
  }
  invalidatePlacementReadCache(Number(input.fromDate.slice(0, 4)));
  return result;
}

export async function logPlacementSyncFailure(input: PlacementSyncInput, actorEmail: string, error: string) {
  const spreadsheetId = await requiredPlacementSpreadsheetId(Number(input.fromDate.slice(0, 4)));
  await ensureManagedTab(spreadsheetId, LOG_TAB, PLACEMENT_SYNC_LOG_HEADERS);
  const end = Date.parse(`${input.toDate}T00:00:00+06:00`) + 86400000;
  await appendSyncLog(spreadsheetId, actorEmail, input, input.cursor ?? snowflake(end), {}, new Date().toISOString(), error);
}

function publicRecord(row: Record<string, string>): PlacementSyncRecord {
  return {
    discord_message_id: row.discord_message_id || '', candidate_name: row.candidate_name || '', candidate_email: row.candidate_email || '',
    company_name: row.company_name || '', position: row.position || '', job_type: row.job_type || '', batch: row.batch || '',
    course: row.course || '', project_name: row.project_name || '', mentor_name: row.mentor_name || '', mentor_email: row.mentor_email || '',
    verification_status: row.verification_status || '', parse_status: row.parse_status || '', posted_at: row.posted_at || '',
    discord_message_url: row.discord_message_url || '',
  };
}

export async function getPlacementStatus(year = new Date().getFullYear()): Promise<PlacementSyncStatus> {
  const cached = placementStatusCache.get(year);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const spreadsheetId = await getPlacementSpreadsheetId(year);
  if (!spreadsheetId) {
    return { ingestionVersion: 1, connectionReady: false, sheetsReady: false, discordConfigured: false, missingProperties: [`PLACEMENT_WORKBOOK_${year}`], spreadsheetTitle: null, spreadsheetUrl: null, masterRows: 0, months: [], recentRecords: [], lastSync: null };
  }
  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' });
  const tabNames = (metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title ?? '');
  const expectedMonthTabs = placementYearTabs(year);
  const currentMonth = dhakaDate(new Date(), 'month');
  const selectedMonth = currentMonth.startsWith(`${year}-`) ? currentMonth : `${year}-12`;
  const currentTab = placementMonthTab(year, Number(selectedMonth.slice(5)));
  const status: PlacementSyncStatus = {
    ingestionVersion: 1,
    connectionReady: true,
    sheetsReady: true,
    discordConfigured: true,
    missingProperties: [],
    spreadsheetTitle: metadata.data.properties?.title ?? 'Placement Management',
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    masterRows: 0,
    months: expectedMonthTabs.filter((name) => tabNames.includes(name)),
    recentRecords: [],
    lastSync: null,
  };
  const [monthValues, logValues] = await Promise.all([
    tabNames.includes(currentTab) ? readValues(spreadsheetId, `${quoteSheet(currentTab)}!A:AD`) : Promise.resolve([]),
    tabNames.includes(LOG_TAB) ? readValues(spreadsheetId, `${LOG_TAB}!A:Q`) : Promise.resolve([]),
  ]);
  const records = table(monthValues, PLACEMENT_WORKBOOK_HEADERS).rows;
  const logs = table(logValues, PLACEMENT_SYNC_LOG_HEADERS);
  status.masterRows = records.length;
  status.recentRecords = [...records].sort((first, second) => second.posted_at.localeCompare(first.posted_at)).slice(0, 200).map(publicRecord);
  status.lastSync = logs.rows.at(-1) ?? null;
  placementStatusCache.set(year, { data: status, expiresAt: Date.now() + PLACEMENT_READ_TTL_MS });
  return status;
}

function placementAnalyticsResult(selectedMonth: string, values: unknown[][]): PlacementAnalyticsResponse {
  const [year] = selectedMonth.split('-').map(Number);
  const availableMonths = placementYearTabs(year).map((title) => `${title.slice(3)}-${title.slice(0, 2)}`).reverse();
  const records = table(values, PLACEMENT_WORKBOOK_HEADERS).rows;
  return {
    selectedMonth,
    availableMonths,
    records: records.map((record) => ({
      discordMessageId: record.discord_message_id,
      postedDate: dhakaDate(record.posted_at, 'date'),
      mentorId: record.mentor_discord_id,
      mentorName: record.mentor_name,
      mentorEmail: record.mentor_email,
      candidateName: record.candidate_name,
      companyName: record.company_name,
      position: record.position,
      placementDate: record.placement_date,
      placementType: placementType(record),
      batch: record.batch,
      verificationStatus: record.verification_status,
      parseStatus: record.parse_status,
    })).filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.postedDate)),
    generatedAt: new Date().toISOString(),
  };
}

export async function getPlacementAnalyticsForMonths(months: string[]): Promise<Map<string, PlacementAnalyticsResponse>> {
  const requested = Array.from(new Set(months));
  requested.forEach((month) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new PlacementSheetsError('Select a valid analytics month.', 'CONFLICT');
  });
  const output = new Map<string, PlacementAnalyticsResponse>();
  const missing = requested.filter((month) => {
    const cached = placementAnalyticsCache.get(month);
    if (cached && cached.expiresAt > Date.now()) { output.set(month, cached.data); return false; }
    return true;
  });
  const byYear = new Map<number, string[]>();
  missing.forEach((month) => {
    const year = Number(month.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), month]);
  });
  await Promise.all(Array.from(byYear.entries()).map(async ([year, yearMonths]) => {
    const spreadsheetId = await requiredPlacementSpreadsheetId(year);
    const sheets = await getSheetsClient();
    const ranges = yearMonths.map((month) => `${quoteSheet(placementMonthTab(year, Number(month.slice(5))))}!A:AD`);
    let valueRanges: unknown[][][];
    try {
      const batch = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
      valueRanges = yearMonths.map((_, index) => batch.data.valueRanges?.[index]?.values ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Unsupported action')) throw error;
      valueRanges = await Promise.all(ranges.map((range) => readValues(spreadsheetId, range)));
    }
    yearMonths.forEach((month, index) => {
      const result = placementAnalyticsResult(month, valueRanges[index] ?? []);
      placementAnalyticsCache.set(month, { data: result, expiresAt: Date.now() + PLACEMENT_READ_TTL_MS });
      output.set(month, result);
    });
  }));
  return output;
}

export async function getPlacementAnalytics(month?: string): Promise<PlacementAnalyticsResponse> {
  const selectedMonth = month || dhakaDate(new Date(), 'month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
    throw new PlacementSheetsError('Select a valid analytics month.', 'CONFLICT');
  }
  const cached = placementAnalyticsCache.get(selectedMonth);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const year = Number(selectedMonth.slice(0, 4));
  const spreadsheetId = await requiredPlacementSpreadsheetId(year);
  const range = `${quoteSheet(placementMonthTab(year, Number(selectedMonth.slice(5))))}!A:AD`;
  let values: unknown[][] = [];
  try {
    values = await readValues(spreadsheetId, range);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/unable to parse range|range not found|sheet.*not found|worksheet.*not found/i.test(message)) throw error;
  }
  const result = placementAnalyticsResult(selectedMonth, values);
  placementAnalyticsCache.set(selectedMonth, { data: result, expiresAt: Date.now() + PLACEMENT_READ_TTL_MS });
  return result;
}
