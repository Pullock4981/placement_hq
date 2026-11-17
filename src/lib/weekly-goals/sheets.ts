import 'server-only';

import { randomUUID } from 'node:crypto';
import { addDays, format, parseISO } from 'date-fns';
import { SHEET_DOMAIN, SHEET_SCOPE, SHEET_TAB } from '@/constants';
import type { JWTPayload } from '@/types';
import { WEEKLY_GOAL_HEADERS } from '@/lib/google-oauth/workbook-templates';
import { getOperationalSheetConnection, SheetConnectionNotFoundError } from '@/lib/sheets/attachments';
import { getSheetsClient } from '@/lib/sheets/client';
import { dhakaToday, scrumCurrentWeek, scrumWeekRange } from '@/lib/scrum-sync/week';
import type { WeeklyGoalComment, WeeklyGoalsData, WeeklyGoalSubmission } from '@/lib/weekly-goals/types';

function quote(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function text(value: unknown) { return String(value ?? ''); }
function identity(value: string) { return value.trim().toLowerCase(); }
function columnLetter(columnNumber: number) { let value = columnNumber; let output = ''; while (value > 0) { const remainder = (value - 1) % 26; output = String.fromCharCode(65 + remainder) + output; value = Math.floor((value - 1) / 26); } return output; }

function currentWeek() {
  const today = dhakaToday();
  const year = Number(today.slice(0, 4));
  const number = scrumCurrentWeek(today);
  const range = scrumWeekRange(year, number, today);
  const end = format(addDays(parseISO(range.fromDate), 6), 'yyyy-MM-dd');
  return { key: `${year}-W${String(number).padStart(2, '0')}`, number, year, start: range.fromDate, end };
}

function selectedWeek(year: number, number: number) {
  const range = scrumWeekRange(year, number, `${year}-12-31`);
  const end = format(addDays(parseISO(range.fromDate), 6), 'yyyy-MM-dd');
  return { key: `${year}-W${String(number).padStart(2, '0')}`, number, year, start: range.fromDate, end };
}

async function destination() {
  try {
    const connection = await getOperationalSheetConnection(SHEET_DOMAIN.WEEKLY_KPIS, SHEET_SCOPE.GLOBAL);
    return { spreadsheetId: connection.spreadsheet_id, tab: connection.worksheet_name || SHEET_TAB.WEEKLY_GOALS };
  } catch (error) {
    if (!(error instanceof SheetConnectionNotFoundError)) throw error;
    const connection = await getOperationalSheetConnection(SHEET_DOMAIN.MONTHLY_KPIS, SHEET_SCOPE.GLOBAL);
    return { spreadsheetId: connection.spreadsheet_id, tab: SHEET_TAB.WEEKLY_GOALS };
  }
}

async function ensureTab(spreadsheetId: string, tab: string) {
  const client = await getSheetsClient();
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(title,sheetId,gridProperties.columnCount)' });
  let sheet = (metadata.data.sheets ?? []).find((candidate) => candidate.properties?.title === tab);
  if (!sheet) {
    const created = await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1, columnCount: WEEKLY_GOAL_HEADERS.length } } } }] } });
    sheet = created.data.replies?.[0]?.addSheet;
  }
  const sheetId = sheet?.properties?.sheetId;
  const columnCount = sheet?.properties?.gridProperties?.columnCount ?? 0;
  if (sheetId !== undefined && sheetId !== null && columnCount < WEEKLY_GOAL_HEADERS.length) {
    await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, gridProperties: { columnCount: WEEKLY_GOAL_HEADERS.length } }, fields: 'gridProperties.columnCount' } }] } });
  }
  const lastColumn = columnLetter(WEEKLY_GOAL_HEADERS.length);
  const response = await client.spreadsheets.values.get({ spreadsheetId, range: `${quote(tab)}!A1:${lastColumn}1` });
  const actual = (response.data.values?.[0] ?? []).map(text);
  if (!actual.length) {
    await client.spreadsheets.values.update({ spreadsheetId, range: `${quote(tab)}!A1`, valueInputOption: 'RAW', requestBody: { values: [Array.from(WEEKLY_GOAL_HEADERS)] } });
  } else if (actual.some((header, index) => WEEKLY_GOAL_HEADERS[index] !== header)) {
    throw new Error(`${tab} has incompatible headers; existing data was not modified.`);
  }
}

async function readRows(spreadsheetId: string, tab: string) {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({ spreadsheetId, range: `${quote(tab)}!A:${columnLetter(WEEKLY_GOAL_HEADERS.length)}` });
  return (response.data.values ?? []).slice(1).map((row) => Object.fromEntries(WEEKLY_GOAL_HEADERS.map((header, index) => [header, text(row[index])])));
}

function parseJsonArray<T>(value: string): T[] {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
}

function record(row: Record<string, string>): WeeklyGoalSubmission {
  return {
    id: row.id, week_key: row.week_key, week_number: Number(row.week_number), year: Number(row.year), week_start: row.week_start, week_end: row.week_end,
    user_id: row.user_id, user_email: row.user_email, user_name: row.user_name, discord_user_id: row.discord_user_id, discord_username: row.discord_username,
    goals: parseJsonArray<string>(row.goals_json).filter((goal) => typeof goal === 'string'),
    comments: parseJsonArray<WeeklyGoalComment>(row.comments_json), created_at: row.created_at, updated_at: row.updated_at,
  };
}

export async function getCurrentWeeklyGoals(user: JWTPayload): Promise<WeeklyGoalsData> {
  const week = currentWeek();
  const target = await destination();
  await ensureTab(target.spreadsheetId, target.tab);
  const allRows = await readRows(target.spreadsheetId, target.tab);
  const match = [...allRows].reverse().find((row) => row.week_key === week.key && identity(row.user_email) === identity(user.email));
  return { week, submission: match ? record(match) : null };
}

export async function getWeeklyGoalsForEmployee(input: { year: number; week: number; discordUserId: string; email?: string }): Promise<WeeklyGoalsData> {
  const week = selectedWeek(input.year, input.week);
  const target = await destination();
  await ensureTab(target.spreadsheetId, target.tab);
  const allRows = await readRows(target.spreadsheetId, target.tab);
  const normalizedEmail = identity(input.email || '');
  const match = [...allRows].reverse().find((row) => row.week_key === week.key && (
    (input.discordUserId && row.discord_user_id === input.discordUserId)
    || (normalizedEmail && identity(row.user_email) === normalizedEmail)
  ));
  return { week, submission: match ? record(match) : null };
}

export async function createCurrentWeeklyGoals(user: JWTPayload, goals: string[]) {
  const existing = await getCurrentWeeklyGoals(user);
  if (existing.submission) throw new Error('Weekly goals have already been submitted for this week and cannot be edited.');
  const target = await destination();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(), week_key: existing.week.key, week_number: existing.week.number, year: existing.week.year,
    week_start: existing.week.start, week_end: existing.week.end, user_id: user.id, user_email: user.email, user_name: user.name,
    discord_user_id: user.discord_user_id || '', discord_username: user.discord_username || '', goals_json: JSON.stringify(goals.map((goal) => goal.trim())),
    comments_json: '[]', created_at: now, updated_at: now,
  };
  const client = await getSheetsClient();
  await client.spreadsheets.values.append({ spreadsheetId: target.spreadsheetId, range: `${quote(target.tab)}!A:${columnLetter(WEEKLY_GOAL_HEADERS.length)}`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [WEEKLY_GOAL_HEADERS.map((header) => row[header as keyof typeof row] ?? '')] } });
  return record(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])));
}

export async function addWeeklyGoalComment(user: JWTPayload, submissionId: string, body: string) {
  const current = await getCurrentWeeklyGoals(user);
  if (!current.submission || current.submission.id !== submissionId) throw new Error('This week’s goal submission was not found.');
  if (identity(current.submission.user_email) !== identity(user.email)) throw new Error('You can only add notes to your own weekly goals.');
  const target = await destination();
  const allRows = await readRows(target.spreadsheetId, target.tab);
  const rowIndex = allRows.findIndex((row) => row.id === submissionId);
  if (rowIndex < 0) throw new Error('This week’s goal submission was not found.');
  const comment: WeeklyGoalComment = { id: randomUUID(), body: body.trim(), author_name: user.name, author_email: user.email, created_at: new Date().toISOString() };
  const comments = [...current.submission.comments, comment];
  const client = await getSheetsClient();
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: target.spreadsheetId, requestBody: { valueInputOption: 'RAW', data: [
    { range: `${quote(target.tab)}!M${rowIndex + 2}`, values: [[JSON.stringify(comments)]] },
    { range: `${quote(target.tab)}!O${rowIndex + 2}`, values: [[comment.created_at]] },
  ] } });
  return { ...current.submission, comments, updated_at: comment.created_at };
}
