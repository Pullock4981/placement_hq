import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { SHEET_DOMAIN, SHEET_TAB } from '@/constants';
import { PLACEMENT_FOLLOWUP_HEADERS, PLACEMENT_WORKBOOK_HEADERS } from '@/lib/google-oauth/workbook-templates';
import { listOperationalSheetConnections } from '@/lib/sheets/attachments';
import { appendRow, createSheet, getSheetsClient, readSheet, sheetExists, updateRow } from '@/lib/sheets/client';
import type { JWTPayload } from '@/types';
import type { EmploymentStage, FollowupCandidate, FollowupMilestone, PlacementFollowupRecord } from './types';

type PlacementRow = Record<(typeof PLACEMENT_WORKBOOK_HEADERS)[number], string>;

function text(value: unknown) { return String(value ?? '').trim(); }
function identity(value: string) { return value.trim().toLowerCase(); }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function dhakaDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function quote(value: string) { return `'${value.replaceAll("'", "''")}'`; }

export function followupTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function ensureFollowupSheet() {
  if (!(await sheetExists(SHEET_TAB.PLACEMENT_FOLLOWUPS))) {
    try { await createSheet(SHEET_TAB.PLACEMENT_FOLLOWUPS, Array.from(PLACEMENT_FOLLOWUP_HEADERS)); }
    catch (error) { if (!(await sheetExists(SHEET_TAB.PLACEMENT_FOLLOWUPS))) throw error; }
  }
}

function record(row: string[]): PlacementFollowupRecord {
  const value = Object.fromEntries(PLACEMENT_FOLLOWUP_HEADERS.map((header, index) => [header, text(row[index])])) as Record<string, string>;
  return { ...value, milestone_days: Number(value.milestone_days) as FollowupMilestone } as PlacementFollowupRecord;
}

export async function listFollowupRecords() {
  await ensureFollowupSheet();
  return (await readSheet(SHEET_TAB.PLACEMENT_FOLLOWUPS)).filter((row) => row[0]).map(record);
}

async function readMentorPlacements(user: JWTPayload): Promise<PlacementRow[]> {
  const sheets = await getSheetsClient();
  let connections = await listOperationalSheetConnections(SHEET_DOMAIN.PLACEMENTS);
  if (!connections.length && process.env.GOOGLE_PLACEMENT_SPREADSHEET_ID?.trim()) {
    connections = [{ domain: SHEET_DOMAIN.PLACEMENTS, batch: String(new Date().getFullYear()), spreadsheet_id: process.env.GOOGLE_PLACEMENT_SPREADSHEET_ID.trim(), worksheet_name: '', access_mode: 'read_write' }];
  }
  connections = connections.filter((connection, index, all) => all.findIndex((candidate) => candidate.spreadsheet_id === connection.spreadsheet_id) === index);
  const rows: PlacementRow[] = [];
  for (const connection of connections) {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: connection.spreadsheet_id, fields: 'sheets.properties.title' });
    const tabs = (metadata.data.sheets ?? []).map((entry) => entry.properties?.title ?? '').filter((title) => /^\d{2}_\d{4}$/.test(title));
    if (!tabs.length) continue;
    const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: connection.spreadsheet_id, ranges: tabs.map((tab) => `${quote(tab)}!A:AD`) });
    for (const range of response.data.valueRanges ?? []) {
      const values = range.values ?? [];
      const headers = (values[0] ?? []).map(text);
      if (PLACEMENT_WORKBOOK_HEADERS.some((header, index) => headers[index] !== header)) continue;
      values.slice(1).forEach((source) => {
        const placement = Object.fromEntries(PLACEMENT_WORKBOOK_HEADERS.map((header, index) => [header, text(source[index])])) as PlacementRow;
        const ownsPlacement = identity(placement.mentor_email) === identity(user.email)
          || Boolean(user.discord_user_id && placement.mentor_discord_id === user.discord_user_id);
        if (ownsPlacement && placement.discord_message_id && placement.candidate_name) rows.push(placement);
      });
    }
  }
  return rows;
}

export async function getMentorFollowupCandidates(user: JWTPayload): Promise<FollowupCandidate[]> {
  const [placements, followups] = await Promise.all([readMentorPlacements(user), listFollowupRecords()]);
  const today = parseISO(dhakaDate(new Date()));
  const recordsByPlacement = new Map<string, Partial<Record<FollowupMilestone, PlacementFollowupRecord>>>();
  followups.filter((item) => item.mentor_id === user.id || identity(item.mentor_email) === identity(user.email)).forEach((item) => {
    recordsByPlacement.set(item.placement_id, { ...(recordsByPlacement.get(item.placement_id) ?? {}), [item.milestone_days]: item });
  });
  const unique = new Map<string, FollowupCandidate>();
  placements.forEach((placement) => {
    const placementDate = validDate(placement.placement_date) ? placement.placement_date : dhakaDate(placement.posted_at);
    if (!validDate(placementDate)) return;
    const age = differenceInCalendarDays(today, parseISO(placementDate));
    if (age < 45) return;
    const followupMap = recordsByPlacement.get(placement.discord_message_id) ?? {};
    if (followupMap[45] && followupMap[90]) return;
    unique.set(placement.discord_message_id, {
      placement_id: placement.discord_message_id,
      name: placement.candidate_name,
      email: placement.candidate_email,
      company: placement.company_name,
      position: placement.position,
      placement_date: placementDate,
      days_since_placement: age,
      followups: followupMap,
    });
  });
  return Array.from(unique.values()).sort((left, right) => right.days_since_placement - left.days_since_placement || left.name.localeCompare(right.name));
}

export async function createFollowupRecord(input: {
  candidate: FollowupCandidate; milestone: FollowupMilestone; user: JWTPayload; subject: string; body: string;
  tokenHash: string; sentFrom: string; providerMessageId: string;
}) {
  const existing = (await listFollowupRecords()).find((item) => item.placement_id === input.candidate.placement_id && item.milestone_days === input.milestone && item.status !== undefined);
  if (existing) return existing;
  const now = new Date().toISOString();
  const value: PlacementFollowupRecord = {
    id: randomUUID(), placement_id: input.candidate.placement_id, milestone_days: input.milestone,
    mentor_id: input.user.id, mentor_email: input.user.email, mentor_name: input.user.name,
    candidate_name: input.candidate.name, candidate_email: input.candidate.email,
    company_name: input.candidate.company, position: input.candidate.position, placement_date: input.candidate.placement_date,
    status: 'sent', email_subject: input.subject, email_body: input.body, response_token_hash: input.tokenHash,
    sent_from: input.sentFrom, provider_message_id: input.providerMessageId, sent_at: now,
    response_status: '', response_reason: '', responded_at: '', created_at: now, updated_at: now,
  };
  await appendRow(SHEET_TAB.PLACEMENT_FOLLOWUPS, PLACEMENT_FOLLOWUP_HEADERS.map((header) => value[header]));
  return value;
}

export async function submitFollowupResponse(token: string, status: EmploymentStage, reason: string) {
  const hash = followupTokenHash(token);
  const records = await listFollowupRecords();
  const index = records.findIndex((item) => item.response_token_hash === hash);
  if (index < 0) throw new Error('This follow-up link is invalid or no longer available.');
  const existing = records[index];
  if (existing.responded_at) return existing;
  const updated: PlacementFollowupRecord = { ...existing, status: 'responded', response_status: status, response_reason: reason, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await updateRow(SHEET_TAB.PLACEMENT_FOLLOWUPS, index + 2, PLACEMENT_FOLLOWUP_HEADERS.map((header) => updated[header]));
  return updated;
}

export async function getFollowupByToken(token: string) {
  const hash = followupTokenHash(token);
  return (await listFollowupRecords()).find((item) => item.response_token_hash === hash) ?? null;
}
