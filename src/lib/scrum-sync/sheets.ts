import 'server-only';

import { randomUUID } from 'node:crypto';
import { addDays, format, parseISO } from 'date-fns';
import { SCRUM_SYNC_LOG_HEADERS, SCRUM_UPDATE_HEADERS } from '@/lib/google-oauth/workbook-templates';
import { getOperationalSheetConnection, invalidateSheetConnectionCache, SheetConnectionNotFoundError } from '@/lib/sheets/attachments';
import { getSheetsClient } from '@/lib/sheets/client';
import { scrumWeekTab, scrumYearTabs, SHEET_DOMAIN, SHEET_TAB } from '@/constants';
import type { DiscordPlacementMessage } from '@/lib/placement-sync/discord';
import type { ScrumDashboardData, ScrumSyncPage, ScrumUpdate } from '@/lib/scrum-sync/types';
import type { ScrumSyncInput } from '@/lib/validators/scrum-sync.schema';
import { scrumWeekNumber } from '@/lib/scrum-sync/week';

type ScrumRecord = Record<(typeof SCRUM_UPDATE_HEADERS)[number], string>;
type ScrumYearState = Pick<ScrumDashboardData, 'year' | 'connectionReady' | 'sheetsReady' | 'spreadsheetTitle' | 'syncedWeeks'> & {
  spreadsheetId: string | null;
  lastSyncedByWeek: Map<number, string>;
};

const YEAR_CACHE_TTL = 5 * 60_000;
const WEEK_CACHE_TTL = 5 * 60_000;
const yearCache = new Map<number, { expiresAt: number; value: ScrumYearState }>();
const weekCache = new Map<string, { expiresAt: number; records: ScrumUpdate[]; employees: ScrumDashboardData['employees'] }>();

export function invalidateScrumReadCache(year?: number) {
  if (year === undefined) {
    yearCache.clear();
    weekCache.clear();
    return;
  }
  yearCache.delete(year);
  Array.from(weekCache.keys()).filter((key) => key.startsWith(`${year}:`)).forEach((key) => weekCache.delete(key));
}

function updateScrumWeekCacheAfterSync(year: number, week: number, completedAt: string, complete: boolean) {
  Array.from(weekCache.keys()).filter((key) => key.startsWith(`${year}:`)).forEach((key) => weekCache.delete(key));
  if (!complete) return;
  const cached = yearCache.get(year);
  if (!cached) return;
  const lastSyncedByWeek = new Map(cached.value.lastSyncedByWeek);
  lastSyncedByWeek.set(week, completedAt);
  const value = {
    ...cached.value,
    syncedWeeks: Array.from(lastSyncedByWeek.keys()).sort((a, b) => a - b),
    lastSyncedByWeek,
  };
  yearCache.set(year, { expiresAt: Date.now() + YEAR_CACHE_TTL, value });
}

export class ScrumSheetsError extends Error {
  constructor(message: string, public readonly code: 'NOT_CONFIGURED' | 'NOT_READY' | 'CONFLICT' | 'GOOGLE_ERROR' = 'GOOGLE_ERROR') {
    super(message);
    this.name = 'ScrumSheetsError';
  }
}

function text(value: unknown) { return String(value ?? ''); }
function quote(title: string) { return `'${title.replaceAll("'", "''")}'`; }
function dhakaDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function weekForDate(date: string) {
  return scrumWeekNumber(date);
}
function tabForDate(date: string) { return scrumWeekTab(date.slice(0, 4), weekForDate(date)); }
function table(values: unknown[][]) {
  const headers = (values[0] ?? []).map(text);
  if (headers.length && SCRUM_UPDATE_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new ScrumSheetsError('A weekly Scrum tab has incompatible headers; existing data was not overwritten.', 'CONFLICT');
  }
  return values.slice(1).map((row) => Object.fromEntries(SCRUM_UPDATE_HEADERS.map((header, index) => [header, text(row[index])]))) as ScrumRecord[];
}

async function workbookId(year: number) {
  try {
    return (await getOperationalSheetConnection(SHEET_DOMAIN.SCRUM_UPDATES, String(year))).spreadsheet_id;
  } catch (error) {
    if (!(error instanceof SheetConnectionNotFoundError)) {
      throw new ScrumSheetsError(
        error instanceof Error ? `Could not read the central Sheet registry: ${error.message}` : 'Could not read the central Sheet registry.',
        'GOOGLE_ERROR',
      );
    }
    invalidateSheetConnectionCache();
    try {
      return (await getOperationalSheetConnection(SHEET_DOMAIN.SCRUM_UPDATES, String(year))).spreadsheet_id;
    } catch (retryError) {
      if (!(retryError instanceof SheetConnectionNotFoundError)) {
        throw new ScrumSheetsError(
          retryError instanceof Error ? `Could not refresh the central Sheet registry: ${retryError.message}` : 'Could not refresh the central Sheet registry.',
          'GOOGLE_ERROR',
        );
      }
      return process.env.GOOGLE_SCRUM_SPREADSHEET_ID?.trim() || null;
    }
  }
}

async function requiredWorkbookId(year: number) {
  const id = await workbookId(year);
  if (!id) throw new ScrumSheetsError(`Assign a Daily Scrum Updates workbook to year ${year} in Sheet Management.`, 'NOT_CONFIGURED');
  return id;
}

async function readValues(spreadsheetId: string, range: string) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values ?? [];
}

export async function setupScrumWorkbook(year: number): Promise<void> {
  const spreadsheetId = await requiredWorkbookId(year);
  const sheets = await getSheetsClient();
  const requiredTabs = [...scrumYearTabs(year), SHEET_TAB.SCRUM_SYNC_LOG];
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const existing = new Set((metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title));
  const missing = requiredTabs.filter((title) => !existing.has(title));
  if (!missing.length) {
    invalidateScrumReadCache(year);
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 20, frozenRowCount: 1 } } } })) },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: missing.map((title) => ({ range: `${quote(title)}!A1`, values: [Array.from(title === SHEET_TAB.SCRUM_SYNC_LOG ? SCRUM_SYNC_LOG_HEADERS : SCRUM_UPDATE_HEADERS)] })),
    },
  });
  invalidateScrumReadCache(year);
}

function emptyRecord(): ScrumRecord {
  return Object.fromEntries(SCRUM_UPDATE_HEADERS.map((header) => [header, ''])) as ScrumRecord;
}

export function parseScrumUpdate(message: DiscordPlacementMessage, guildId: string, channelId: string): ScrumRecord | null {
  if (message.author.bot) return null;
  const raw = message.content.trim();
  if (!raw && !message.embeds.length) return null;
  const fields = { yesterday: '', today: '', blockers: '' };
  const aliases: Record<string, keyof typeof fields> = {
    yesterday: 'yesterday', done: 'yesterday', completed: 'yesterday', accomplishments: 'yesterday',
    todaysachievement: 'yesterday', todaysachievements: 'yesterday',
    today: 'today', plan: 'today', plans: 'today', doing: 'today',
    topprioritiesgoalsoftheday: 'today', topprioritiesoftheday: 'today', todaysgoals: 'today',
    blocker: 'blockers', blockers: 'blockers', blocked: 'blockers', impediments: 'blockers',
    blockerhelpneeded: 'blockers', blockershelpneeded: 'blockers',
  };
  const lines = raw.split(/\r?\n/);
  message.embeds.forEach((embed) => {
    if (embed.description) lines.push(...embed.description.split(/\r?\n/));
    embed.fields?.forEach((field) => lines.push(`${field.name}: ${field.value}`));
  });
  let current: keyof typeof fields | null = null;
  lines.forEach((line) => {
    const cleaned = line.replace(/\*\*/g, '').replace(/^\s*[-*•]\s*/, '').trim();
    if (!cleaned) return;
    const match = cleaned.match(/^([^:：]+)[:：]\s*(.*)$/);
    const alias = match ? aliases[match[1].toLowerCase().replace(/[^a-z]/g, '')] : undefined;
    if (match) {
      current = alias ?? null;
      if (alias) fields[alias] = match[2]?.trim() ?? '';
    } else if (current) {
      fields[current] = [fields[current], cleaned].filter(Boolean).join('\n');
    }
  });
  const updateDate = dhakaDate(message.timestamp);
  const record = emptyRecord();
  record.discord_message_id = message.id;
  record.posted_at = message.timestamp;
  record.update_date = updateDate;
  record.week_key = `${updateDate.slice(0, 4)}-W${String(weekForDate(updateDate)).padStart(2, '0')}`;
  record.employee_discord_id = message.author.id;
  record.employee_name = message.member?.nick || message.author.global_name || message.author.username;
  record.employee_email = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase() ?? '';
  record.yesterday = fields.yesterday;
  record.today = fields.today || (!fields.yesterday && !fields.blockers ? raw : '');
  record.blockers = fields.blockers;
  record.raw_message = raw;
  record.parse_status = fields.today || fields.yesterday || fields.blockers ? 'valid' : 'needs_review';
  record.parse_errors = record.parse_status === 'valid' ? '' : 'No Yesterday, Today, or Blockers headings were detected';
  record.discord_message_url = `https://discord.com/channels/${guildId}/${channelId}/${message.id}`;
  record.synced_at = new Date().toISOString();
  record.updated_at = record.synced_at;
  return record;
}

async function writeRecords(spreadsheetId: string, tabName: string, incoming: ScrumRecord[]) {
  const existingRows = table(await readValues(spreadsheetId, `${quote(tabName)}!A:P`));
  const indexes = new Map(existingRows.map((row, index) => [row.discord_message_id, index]));
  const additions: string[][] = [];
  const updates: Array<{ range: string; values: string[][] }> = [];
  let unchanged = 0;
  incoming.forEach((record) => {
    const index = indexes.get(record.discord_message_id);
    const row = SCRUM_UPDATE_HEADERS.map((header) => record[header]);
    if (index === undefined) additions.push(row);
    else if (SCRUM_UPDATE_HEADERS.every((header) => header === 'synced_at' || header === 'updated_at' || existingRows[index][header] === record[header])) unchanged += 1;
    else updates.push({ range: `${quote(tabName)}!A${index + 2}:P${index + 2}`, values: [row] });
  });
  const sheets = await getSheetsClient();
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: updates } });
  if (additions.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: `${quote(tabName)}!A:P`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: additions } });
  return { inserted: additions.length, updated: updates.length, unchanged };
}

function snowflake(time: number) { return (BigInt(Math.max(0, time - 1420070400000)) << BigInt(22)).toString(); }

export async function ingestScrumPage(input: ScrumSyncInput, actorEmail: string, source: { channelId: string; guildId: string; messages: DiscordPlacementMessage[] }): Promise<ScrumSyncPage> {
  const year = Number(input.fromDate.slice(0, 4));
  const spreadsheetId = await requiredWorkbookId(year);
  const start = Date.parse(`${input.fromDate}T00:00:00+06:00`);
  const end = Date.parse(`${input.toDate}T00:00:00+06:00`) + 86_400_000;
  const selected = source.messages.filter((message) => Date.parse(message.timestamp) >= start && Date.parse(message.timestamp) < end);
  const records = selected.flatMap((message) => {
    const record = parseScrumUpdate(message, source.guildId, source.channelId);
    return record ? [record] : [];
  });
  const grouped = new Map<string, ScrumRecord[]>();
  records.forEach((record) => grouped.set(tabForDate(record.update_date), [...(grouped.get(tabForDate(record.update_date)) ?? []), record]));
  const counters = { inserted: 0, updated: 0, unchanged: 0 };
  for (const [tabName, rows] of Array.from(grouped.entries())) {
    const values = await readValues(spreadsheetId, `${quote(tabName)}!A1:P1`);
    if (!values.length) {
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${quote(tabName)}!A1:P1`, valueInputOption: 'RAW', requestBody: { values: [Array.from(SCRUM_UPDATE_HEADERS)] } });
    } else table(values);
    const result = await writeRecords(spreadsheetId, tabName, rows);
    counters.inserted += result.inserted;
    counters.updated += result.updated;
    counters.unchanged += result.unchanged;
  }
  const oldest = source.messages.reduce<DiscordPlacementMessage | null>((current, message) => !current || BigInt(message.id) < BigInt(current.id) ? message : current, null);
  const complete = source.messages.length < 100 || !oldest || Date.parse(oldest.timestamp) < start;
  const result: ScrumSyncPage = { runId: input.runId, fetched: selected.length, ignored: selected.length - records.length, nextCursor: complete ? null : oldest?.id ?? null, complete, ...counters };
  const completedAt = new Date().toISOString();
  const logRow: Record<string, string | number | boolean> = {
    id: randomUUID(),
    run_id: input.runId,
    from_date: input.fromDate,
    to_date: input.toDate,
    cursor: input.cursor ?? snowflake(end),
    actor_email: actorEmail,
    fetched: result.fetched,
    inserted: result.inserted,
    updated: result.updated,
    unchanged: result.unchanged,
    ignored: result.ignored,
    next_cursor: result.nextCursor ?? '',
    status: result.complete ? 'completed' : 'page_saved',
    error: '',
    started_at: new Date().toISOString(),
    completed_at: completedAt,
  };
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({ spreadsheetId, range: `${SHEET_TAB.SCRUM_SYNC_LOG}!A:Q`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [SCRUM_SYNC_LOG_HEADERS.map((header) => logRow[header] ?? '')] } });
  updateScrumWeekCacheAfterSync(year, scrumWeekNumber(input.fromDate), completedAt, result.complete);
  return result;
}

function tabsForRange(fromDate: string, toDate: string) {
  const tabs = new Set<string>();
  for (let date = parseISO(fromDate); date <= parseISO(toDate); date = addDays(date, 1)) tabs.add(tabForDate(format(date, 'yyyy-MM-dd')));
  return Array.from(tabs);
}

async function getScrumYearState(year: number): Promise<ScrumYearState> {
  const cached = yearCache.get(year);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const id = await workbookId(year);
  if (!id) {
    const value: ScrumYearState = { year, spreadsheetId: null, connectionReady: false, sheetsReady: false, spreadsheetTitle: null, syncedWeeks: [], lastSyncedByWeek: new Map() };
    yearCache.set(year, { expiresAt: Date.now() + 30_000, value });
    return value;
  }
  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'properties.title,sheets.properties.title' });
  const names = new Set((metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title));
  const required = scrumYearTabs(year);
  const sheetsReady = required.every((name) => names.has(name)) && names.has(SHEET_TAB.SCRUM_SYNC_LOG);
  const lastSyncedByWeek = new Map<number, string>();
  if (sheetsReady) {
    const logRows = await readValues(id, `${quote(SHEET_TAB.SCRUM_SYNC_LOG)}!A:Q`);
    const headers = (logRows[0] ?? []).map(text);
    logRows.slice(1).forEach((row) => {
      const entry = Object.fromEntries(headers.map((header, index) => [header, text(row[index])]));
      if (entry.status !== 'completed' || entry.error || !entry.from_date?.startsWith(`${year}-`)) return;
      const week = scrumWeekNumber(entry.from_date);
      const completedAt = entry.completed_at || entry.started_at || '';
      if (!lastSyncedByWeek.has(week) || completedAt > (lastSyncedByWeek.get(week) ?? '')) lastSyncedByWeek.set(week, completedAt);
    });
  }
  const value: ScrumYearState = {
    year,
    spreadsheetId: id,
    connectionReady: true,
    sheetsReady,
    spreadsheetTitle: metadata.data.properties?.title ?? 'Daily Scrum Management',
    syncedWeeks: Array.from(lastSyncedByWeek.keys()).sort((a, b) => a - b),
    lastSyncedByWeek,
  };
  yearCache.set(year, { expiresAt: Date.now() + YEAR_CACHE_TTL, value });
  return value;
}

export async function getScrumConnectionStatus(year: number, forceRefresh = false) {
  if (forceRefresh) yearCache.delete(year);
  const state = await getScrumYearState(year);
  return {
    connectionReady: state.connectionReady,
    sheetsReady: state.sheetsReady,
    spreadsheetTitle: state.spreadsheetTitle,
  };
}

export async function ensureScrumWorkbookReady(year: number) {
  const state = await getScrumYearState(year);
  if (!state.spreadsheetId) throw new ScrumSheetsError(`Assign a Daily Scrum Updates workbook to year ${year} in Sheet Management.`, 'NOT_CONFIGURED');
  if (!state.sheetsReady) await setupScrumWorkbook(year);
}

export async function getScrumDashboard(input: { year: number; fromDate: string; toDate: string; employee?: string }): Promise<ScrumDashboardData> {
  const discord = Boolean(process.env.DISCORD_BOT_TOKEN && /^\d{17,20}$/.test(process.env.DISCORD_SCRUM_CHANNEL_ID || ''));
  const state = await getScrumYearState(input.year);
  const selectedWeek = scrumWeekNumber(input.fromDate);
  const base = {
    year: input.year,
    connectionReady: state.connectionReady,
    sheetsReady: state.sheetsReady,
    discordConfigured: discord,
    spreadsheetTitle: state.spreadsheetTitle,
    syncedWeeks: state.syncedWeeks,
    selectedWeekSynced: state.syncedWeeks.includes(selectedWeek),
    lastSyncedAt: state.lastSyncedByWeek.get(selectedWeek) ?? null,
  };
  if (!state.spreadsheetId) return { ...base, missingProperties: [`Assign a Daily Scrum Updates workbook to ${input.year} in Sheet Management`], records: [], employees: [] };
  if (!state.sheetsReady) return { ...base, missingProperties: [], records: [], employees: [] };
  const cacheKey = `${input.year}:${input.fromDate}:${input.toDate}`;
  let weekly = weekCache.get(cacheKey);
  if (!weekly || weekly.expiresAt <= Date.now()) {
    const rows = (await Promise.all(tabsForRange(input.fromDate, input.toDate).map((tab) => readValues(state.spreadsheetId!, `${quote(tab)}!A:P`)))).flatMap(table);
    const allEmployees = new Map<string, { id: string; name: string; email: string }>();
    rows.forEach((row) => allEmployees.set(row.employee_discord_id, { id: row.employee_discord_id, name: row.employee_name, email: row.employee_email }));
    weekly = {
      expiresAt: Date.now() + WEEK_CACHE_TTL,
      records: rows.filter((row) => row.update_date >= input.fromDate && row.update_date <= input.toDate).sort((a, b) => b.posted_at.localeCompare(a.posted_at)) as ScrumUpdate[],
      employees: Array.from(allEmployees.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
    weekCache.set(cacheKey, weekly);
  }
  const records = input.employee ? weekly.records.filter((row) => row.employee_discord_id === input.employee) : weekly.records;
  return { ...base, missingProperties: [], records, employees: weekly.employees };
}
