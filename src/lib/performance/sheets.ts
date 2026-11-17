import 'server-only';

import { randomUUID } from 'node:crypto';
import type { JWTPayload, TeamRole } from '@/types';
import { PERFORMANCE_APPROVAL_STATUS, PERFORMANCE_PLAN_TYPE, PERFORMANCE_STATUS, SHEET_DOMAIN, SHEET_SCOPE, SHEET_TAB, TEAM_MONTHLY_KPI } from '@/constants';
import { getOperationalSheetConnection, SheetConnectionNotFoundError } from '@/lib/sheets/attachments';
import { getSheetsClient } from '@/lib/sheets/client';
import type { PerformancePlanCreateInput } from '@/lib/validators/performance-plan.schema';
import type { MonthlyKpiRecord, OkrKeyResult, PerformancePlanData, QuarterlyOkrRecord } from '@/lib/performance/types';
import type { PlacementAnalyticsResponse } from '@/lib/placement-analytics/types';
import { PERFORMANCE_PLAN_HEADERS } from '@/lib/google-oauth/workbook-templates';
import { getAllUsers } from '@/lib/sheets/users';
import { getPlacementAnalyticsForMonths } from '@/lib/placement-sync/sheets';

function quote(title: string) { return `'${title.replaceAll("'", "''")}'`; }
function text(value: unknown) { return String(value ?? ''); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function identity(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
function columnLetter(columnNumber: number) { let value = columnNumber; let output = ''; while (value > 0) { const remainder = (value - 1) % 26; output = String.fromCharCode(65 + remainder) + output; value = Math.floor((value - 1) / 26); } return output; }
const monthlyGoalCache = new Map<string, { records: MonthlyKpiRecord[]; expiresAt: number }>();
function invalidatePerformanceReadCache() { monthlyGoalCache.clear(); }

async function target() {
  try {
    const connection = await getOperationalSheetConnection(SHEET_DOMAIN.MONTHLY_KPIS, SHEET_SCOPE.GLOBAL);
    return { spreadsheetId: connection.spreadsheet_id, tab: connection.worksheet_name || SHEET_TAB.PERFORMANCE_PLANS };
  } catch (error) {
    if (!(error instanceof SheetConnectionNotFoundError)) throw error;
    try {
      const connection = await getOperationalSheetConnection(SHEET_DOMAIN.QUARTERLY_OKRS, SHEET_SCOPE.GLOBAL);
      return { spreadsheetId: connection.spreadsheet_id, tab: connection.worksheet_name || SHEET_TAB.PERFORMANCE_PLANS };
    } catch (quarterlyError) {
      if (!(quarterlyError instanceof SheetConnectionNotFoundError)) throw quarterlyError;
      throw new Error('Create the Monthly Goals workbook from Admin Sheet Management first.');
    }
  }
}

async function ensurePerformanceTab(spreadsheetId: string, tab: string) {
  const client = await getSheetsClient();
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(title,sheetId,gridProperties.columnCount)' });
  let sheet = (metadata.data.sheets ?? []).find((candidate) => candidate.properties?.title === tab);
  if (!sheet) {
    try {
      const created = await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1, columnCount: PERFORMANCE_PLAN_HEADERS.length } } } }] } });
      sheet = created.data.replies?.[0]?.addSheet;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(`A sheet with the name "${tab}" already exists`)) throw error;
      const refreshed = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(title,sheetId,gridProperties.columnCount)' });
      sheet = (refreshed.data.sheets ?? []).find((candidate) => candidate.properties?.title === tab);
    }
  }
  const sheetId = sheet?.properties?.sheetId;
  const columnCount = sheet?.properties?.gridProperties?.columnCount ?? 0;
  if (sheetId !== undefined && sheetId !== null && columnCount < PERFORMANCE_PLAN_HEADERS.length) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, gridProperties: { columnCount: PERFORMANCE_PLAN_HEADERS.length } }, fields: 'gridProperties.columnCount' } }] },
    });
  }
  const response = await client.spreadsheets.values.get({ spreadsheetId, range: `${quote(tab)}!A1:${columnLetter(PERFORMANCE_PLAN_HEADERS.length)}1` });
  const actual = (response.data.values?.[0] ?? []).map(text);
  if (!actual.length) {
    await client.spreadsheets.values.update({ spreadsheetId, range: `${quote(tab)}!A1`, valueInputOption: 'RAW', requestBody: { values: [Array.from(PERFORMANCE_PLAN_HEADERS)] } });
    return;
  }
  if (actual.some((header, index) => PERFORMANCE_PLAN_HEADERS[index] !== header)) throw new Error(`${tab} has incompatible headers; existing data was not modified.`);
  if (actual.length < PERFORMANCE_PLAN_HEADERS.length) await client.spreadsheets.values.update({ spreadsheetId, range: `${quote(tab)}!${columnLetter(actual.length + 1)}1`, valueInputOption: 'RAW', requestBody: { values: [Array.from(PERFORMANCE_PLAN_HEADERS.slice(actual.length))] } });
}

async function rows(spreadsheetId: string, tab: string) {
  const client = await getSheetsClient();
  const response = await client.spreadsheets.values.get({ spreadsheetId, range: `${quote(tab)}!A:${columnLetter(PERFORMANCE_PLAN_HEADERS.length)}` });
  const values = response.data.values ?? [];
  const actual = (values[0] ?? []).map(text);
  if (actual.length && actual.some((header, index) => PERFORMANCE_PLAN_HEADERS[index] !== header)) throw new Error(`${tab} has incompatible headers.`);
  return values.slice(1).map((row) => Object.fromEntries(PERFORMANCE_PLAN_HEADERS.map((header, index) => [header, text(row[index])])));
}

async function appendRow(spreadsheetId: string, tab: string, record: Record<string, unknown>) {
  const client = await getSheetsClient();
  await client.spreadsheets.values.append({ spreadsheetId, range: `${quote(tab)}!A:${columnLetter(PERFORMANCE_PLAN_HEADERS.length)}`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [PERFORMANCE_PLAN_HEADERS.map((header) => record[header] ?? '')] } });
}

function monthlyRecord(row: Record<string, string>): MonthlyKpiRecord {
  return {
    id: row.id, type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI, user_id: row.user_id, user_email: row.user_email, user_name: row.user_name,
    role: row.access_role as MonthlyKpiRecord['role'], month: row.month || row.period_key, title: row.title, metric: row.metric,
    target_value: number(row.target_value), baseline_value: row.baseline_value === '' ? null : number(row.baseline_value), unit: row.unit,
    direction: row.direction, status: row.status, notes: row.notes, manager_note: row.manager_note, created_at: row.created_at, updated_at: row.updated_at,
    achieved_count: 0, remaining_count: number(row.target_value), progress_percent: 0, plan_kind: 'KPI',
    team_role: (row.team_role || 'mentor') as TeamRole, approval_status: (row.approval_status || 'approved') as MonthlyKpiRecord['approval_status'],
    submitted_by: row.submitted_by, approved_by: row.approved_by, approved_at: row.approved_at, edit_count: number(row.edit_count),
    discord_user_id: row.discord_user_id, discord_username: row.discord_username,
  };
}

function okrRecord(row: Record<string, string>): QuarterlyOkrRecord {
  let keyResults: OkrKeyResult[] = [];
  try { keyResults = JSON.parse(row.key_results_json || '[]') as OkrKeyResult[]; } catch { keyResults = []; }
  return { id: row.id, type: PERFORMANCE_PLAN_TYPE.QUARTERLY_OKR, user_id: row.user_id, user_email: row.user_email, user_name: row.user_name, role: row.access_role as QuarterlyOkrRecord['role'], year: row.year, quarter: row.quarter, objective: row.title, key_results: keyResults, status: row.status, notes: row.notes, manager_note: row.manager_note, created_at: row.created_at, updated_at: row.updated_at, discord_user_id: row.discord_user_id, discord_username: row.discord_username, approval_status: (row.approval_status || 'approved') as QuarterlyOkrRecord['approval_status'], submitted_by: row.submitted_by, approved_by: row.approved_by, approved_at: row.approved_at };
}

export async function listPerformancePlans(user: JWTPayload, month?: string): Promise<PerformancePlanData> {
  const destination = await target();
  const [allRows, users] = await Promise.all([rows(destination.spreadsheetId, destination.tab), getAllUsers()]);
  const personalOnly = user.role === 'mentor';
  const owns = (row: { user_email: string }) => !personalOnly || identity(row.user_email) === identity(user.email);
  const monthlyKpis = allRows.filter((row) => row.plan_kind === 'KPI' && row.period_type === 'monthly' && (!month || row.period_key === month)).map(monthlyRecord).filter(owns);
  const quarterlyOkrs = allRows.filter((row) => row.plan_kind === 'OKR' && row.period_type === 'quarterly').map(okrRecord).filter(owns);
  const goalMonths = Array.from(new Set(monthlyKpis.filter((goal) => goal.team_role === 'mentor').map((goal) => goal.month)));
  const analyticsByMonth = await getPlacementAnalyticsForMonths(goalMonths).catch(() => new Map<string, PlacementAnalyticsResponse>());
  monthlyKpis.forEach((goal) => {
    if (goal.team_role !== 'mentor') return;
    const analytics = analyticsByMonth.get(goal.month);
    if (!analytics) return;
    const matchingIds = new Set(analytics.records.filter((record) => goal.discord_user_id ? record.mentorId === goal.discord_user_id : identity(record.mentorEmail || '') === identity(goal.user_email)).map((record) => record.discordMessageId));
    goal.achieved_count = matchingIds.size;
    goal.remaining_count = Math.max(0, goal.target_value - goal.achieved_count);
    goal.progress_percent = goal.target_value ? Math.round((goal.achieved_count / goal.target_value) * 100) : 0;
  });
  return { monthlyKpis: monthlyKpis.sort((a, b) => b.month.localeCompare(a.month) || a.user_name.localeCompare(b.user_name)), quarterlyOkrs: quarterlyOkrs.sort((a, b) => `${b.year}-${b.quarter}`.localeCompare(`${a.year}-${a.quarter}`)), mentors: personalOnly ? [] : users.filter((candidate) => candidate.role === 'mentor' && candidate.active && candidate.status === 'active').map(({ id, name, email, team_role, team_nickname }) => ({ id, name, email, team_role, team_nickname })).sort((a, b) => a.name.localeCompare(b.name)), scope: personalOnly ? 'personal' : 'team' };
}

export async function createPerformancePlan(user: JWTPayload, input: PerformancePlanCreateInput) {
  const destination = await target();
  await ensurePerformanceTab(destination.spreadsheetId, destination.tab);
  const allRows = await rows(destination.spreadsheetId, destination.tab);
  const users = await getAllUsers();
  const now = new Date().toISOString();
  const id = randomUUID();
  if (input.type === PERFORMANCE_PLAN_TYPE.MONTHLY_KPI) {
    const owner = user.role === 'mentor' ? users.find((candidate) => identity(candidate.email) === identity(user.email) && candidate.active) : users.find((candidate) => candidate.id === input.mentor_id && identity(candidate.email) === identity(input.mentor_email) && candidate.active);
    if (!owner) throw new Error(user.role === 'mentor' ? 'Your active user profile could not be found.' : 'Select an active team member.');
    const teamRole = owner.team_role || 'mentor';
    const definition = TEAM_MONTHLY_KPI[teamRole];
    const title = input.agenda.trim();
    if (user.role === 'mentor' && allRows.some((row) => row.plan_kind === 'KPI' && row.period_type === 'monthly' && row.period_key === input.month && identity(row.user_email) === identity(owner.email))) throw new Error(`You already have a monthly goal for ${input.month}.`);
    if (allRows.some((row) => row.plan_kind === 'KPI' && row.period_type === 'monthly' && row.period_key === input.month && identity(row.user_email) === identity(owner.email) && identity(row.title) === identity(title))) throw new Error(`${owner.name} already has the “${title}” goal for ${input.month}.`);
    const approvalStatus = user.role === 'mentor' ? PERFORMANCE_APPROVAL_STATUS.PENDING : PERFORMANCE_APPROVAL_STATUS.APPROVED;
    const row = { id, plan_kind: 'KPI', period_type: 'monthly', period_key: input.month, month: input.month, user_id: owner.id, discord_user_id: owner.discord_user_id || '', discord_username: owner.discord_username || '', user_email: owner.email, user_name: owner.name, access_role: owner.role, team_role: teamRole, title, metric: definition.metric, target_value: Number(input.target_value), baseline_value: '', unit: definition.unit, direction: 'increase', key_results_json: '', status: PERFORMANCE_STATUS.ACTIVE, approval_status: approvalStatus, notes: input.notes, submitted_by: user.email, approved_by: approvalStatus === 'approved' ? user.email : '', approved_at: approvalStatus === 'approved' ? now : '', edit_count: 0, created_at: now, updated_at: now, manager_note: '' };
    await appendRow(destination.spreadsheetId, destination.tab, row);
    invalidatePerformanceReadCache();
    return monthlyRecord(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])));
  }
  const owner = users.find((candidate) => identity(candidate.email) === identity(user.email));
  const keyResults = input.key_results.map((result) => ({ title: result.title, target_value: Number(result.target_value), unit: result.unit }));
  const approvalStatus = user.role === 'mentor' ? PERFORMANCE_APPROVAL_STATUS.PENDING : PERFORMANCE_APPROVAL_STATUS.APPROVED;
  const row = { id, plan_kind: 'OKR', period_type: 'quarterly', period_key: `${input.year}-${input.quarter}`, year: input.year, quarter: input.quarter, user_id: user.id, discord_user_id: owner?.discord_user_id || '', discord_username: owner?.discord_username || '', user_email: user.email, user_name: user.name, access_role: user.role, team_role: owner?.team_role || 'mentor', title: input.objective, metric: 'Key results', target_value: '', baseline_value: '', unit: '', direction: '', key_results_json: JSON.stringify(keyResults), status: PERFORMANCE_STATUS.ACTIVE, approval_status: approvalStatus, notes: input.notes, submitted_by: user.email, approved_by: approvalStatus === 'approved' ? user.email : '', approved_at: approvalStatus === 'approved' ? now : '', edit_count: 0, created_at: now, updated_at: now, manager_note: '' };
  await appendRow(destination.spreadsheetId, destination.tab, row);
  invalidatePerformanceReadCache();
  return okrRecord(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])));
}

export async function updateMonthlyKpi(user: JWTPayload, input: { id: string; agenda: string; target_value: string; notes: string }) {
  const destination = await target();
  await ensurePerformanceTab(destination.spreadsheetId, destination.tab);
  const allRows = await rows(destination.spreadsheetId, destination.tab);
  const rowIndex = allRows.findIndex((row) => row.id === input.id && row.plan_kind === 'KPI');
  if (rowIndex === -1) throw new Error('Monthly KPI not found.');
  const current = monthlyRecord(allRows[rowIndex]);
  if (user.role !== 'mentor' || identity(current.user_email) !== identity(user.email)) throw new Error('Only the mentor who submitted this goal can edit it.');
  if (current.approval_status === PERFORMANCE_APPROVAL_STATUS.APPROVED) throw new Error('Approved goals cannot be edited. Ask a manager to return the goal with a comment first.');
  const now = new Date().toISOString();
  const approval = PERFORMANCE_APPROVAL_STATUS.PENDING;
  const updates: Record<string, string | number> = { title: input.agenda, target_value: Number(input.target_value), notes: input.notes, updated_at: now, approval_status: approval, edit_count: current.edit_count + 1, approved_by: '', approved_at: '' };
  const client = await getSheetsClient();
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: destination.spreadsheetId, requestBody: { valueInputOption: 'RAW', data: Object.entries(updates).map(([field, value]) => ({ range: `${quote(destination.tab)}!${columnLetter(PERFORMANCE_PLAN_HEADERS.indexOf(field as typeof PERFORMANCE_PLAN_HEADERS[number]) + 1)}${rowIndex + 2}`, values: [[value]] })) } });
  invalidatePerformanceReadCache();
  return { ...current, title: input.agenda, target_value: Number(input.target_value), notes: input.notes, updated_at: now, approval_status: approval, edit_count: Number(updates.edit_count), approved_by: '', approved_at: '' };
}

export async function addPerformancePlanComment(user: JWTPayload, input: { id: string; review_action: 'comment'; manager_note: string }) {
  if (user.role !== 'manager' && user.role !== 'admin') throw new Error('Only managers and admins can comment on monthly goals.');
  const destination = await target();
  await ensurePerformanceTab(destination.spreadsheetId, destination.tab);
  const allRows = await rows(destination.spreadsheetId, destination.tab);
  const rowIndex = allRows.findIndex((row) => row.id === input.id && row.plan_kind === 'KPI' && row.period_type === 'monthly');
  if (rowIndex === -1) throw new Error('Monthly goal not found.');
  if (allRows[rowIndex].approval_status === PERFORMANCE_APPROVAL_STATUS.APPROVED) throw new Error('Approved goals are locked and cannot receive additional comments.');
  const now = new Date().toISOString();
  const updates = { manager_note: input.manager_note, approval_status: PERFORMANCE_APPROVAL_STATUS.PENDING, approved_by: '', approved_at: '', updated_at: now };
  const client = await getSheetsClient();
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: destination.spreadsheetId, requestBody: { valueInputOption: 'RAW', data: Object.entries(updates).map(([field, value]) => ({ range: `${quote(destination.tab)}!${columnLetter(PERFORMANCE_PLAN_HEADERS.indexOf(field as typeof PERFORMANCE_PLAN_HEADERS[number]) + 1)}${rowIndex + 2}`, values: [[value]] })) } });
  invalidatePerformanceReadCache();
  return { id: input.id, ...updates };
}

export async function updatePerformancePlanApproval(user: JWTPayload, input: { id: string; approval_status: 'approved' | 'rejected' }) {
  if (user.role !== 'manager' && user.role !== 'admin') throw new Error('Only managers and admins can approve performance plans.');
  const destination = await target();
  await ensurePerformanceTab(destination.spreadsheetId, destination.tab);
  const allRows = await rows(destination.spreadsheetId, destination.tab);
  const rowIndex = allRows.findIndex((row) => row.id === input.id);
  if (rowIndex === -1) throw new Error('Performance plan not found.');
  if (allRows[rowIndex].approval_status === PERFORMANCE_APPROVAL_STATUS.APPROVED) throw new Error('This performance plan is already approved and locked.');
  const now = new Date().toISOString();
  const updates = { approval_status: input.approval_status, approved_by: input.approval_status === 'approved' ? user.email : '', approved_at: input.approval_status === 'approved' ? now : '', updated_at: now };
  const client = await getSheetsClient();
  await client.spreadsheets.values.batchUpdate({ spreadsheetId: destination.spreadsheetId, requestBody: { valueInputOption: 'RAW', data: Object.entries(updates).map(([field, value]) => ({ range: `${quote(destination.tab)}!${columnLetter(PERFORMANCE_PLAN_HEADERS.indexOf(field as typeof PERFORMANCE_PLAN_HEADERS[number]) + 1)}${rowIndex + 2}`, values: [[value]] })) } });
  invalidatePerformanceReadCache();
  return { id: input.id, ...updates };
}

export async function listMonthlyKpiGoals(month: string) {
  const cached = monthlyGoalCache.get(month);
  if (cached && cached.expiresAt > Date.now()) return cached.records;
  const destination = await target();
  const records = (await rows(destination.spreadsheetId, destination.tab)).filter((row) => row.plan_kind === 'KPI' && row.period_type === 'monthly' && row.period_key === month).map(monthlyRecord);
  monthlyGoalCache.set(month, { records, expiresAt: Date.now() + 60 * 1000 });
  return records;
}
