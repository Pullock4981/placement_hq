import 'server-only';

import { randomUUID } from 'node:crypto';
import { TEAM_ROLE_NICKNAMES, TEAM_ROLE_OPTIONS, TEAM_ROLES, USER_ROLES, USER_STATUSES } from '@/constants';
import { getAccessControlSpreadsheetId, getSheetsClient } from '@/lib/sheets/client';
import type { TeamRole, UserRole, UserStatus } from '@/types';

export const AUTH_USER_HEADERS = [
  'id',
  'name',
  'email',
  'role',
  'status',
  'active',
  'password_hash',
  'last_login_at',
  'created_at',
  'updated_at',
  'team_role',
  'team_nickname',
  'discord_username',
  'discord_user_id',
] as const;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  active: boolean;
  team_role: TeamRole;
  team_nickname: string;
  discord_username: string;
  discord_user_id: string;
}

export interface RegistrationInput {
  name: string;
  email: string;
  passwordHash: string;
  teamRole: TeamRole;
  discordUsername: string;
  discordUserId: string;
}

export class DuplicateAccountError extends Error {
  constructor() {
    super('An account with this email already exists.');
  }
}

export class DuplicateDiscordIdentityError extends Error {
  constructor() {
    super('This Discord user ID is already connected to another account.');
  }
}

interface UserTable {
  headers: string[];
  rows: string[][];
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function truthy(value: unknown) {
  return ['true', 'yes', '1'].includes(String(value ?? '').trim().toLowerCase());
}

function column(headers: string[], name: string) {
  return headers.indexOf(name);
}

function cell(row: string[], headers: string[], name: string) {
  const index = column(headers, name);
  return index === -1 ? '' : String(row[index] ?? '');
}

function columnLetter(columnNumber: number) {
  let value = columnNumber;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function rowToUser(row: string[], headers: string[]): AuthUser {
  const rawRole = cell(row, headers, 'role').trim().toLowerCase();
  const rawStatus = cell(row, headers, 'status').trim().toLowerCase();
  const rawTeamRole = cell(row, headers, 'team_role') as TeamRole;
  return {
    id: cell(row, headers, 'id'),
    name: cell(row, headers, 'name'),
    email: normalizeEmail(cell(row, headers, 'email')),
    password_hash: cell(row, headers, 'password_hash'),
    role: USER_ROLES.includes(rawRole as UserRole) ? rawRole as UserRole : 'mentor',
    status: USER_STATUSES.includes(rawStatus as UserStatus) ? rawStatus as UserStatus : 'pending',
    active: USER_ROLES.includes(rawRole as UserRole) && truthy(cell(row, headers, 'active')),
    team_role: TEAM_ROLES.includes(rawTeamRole) ? rawTeamRole : 'mentor',
    team_nickname: cell(row, headers, 'team_nickname'),
    discord_username: cell(row, headers, 'discord_username'),
    discord_user_id: cell(row, headers, 'discord_user_id'),
  };
}

async function readUserTable(): Promise<UserTable> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getAccessControlSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'users!A:ZZ' });
  const values = (response.data.values ?? []).map((row) => row.map((value) => String(value ?? '')));
  if (!values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `users!A1:${columnLetter(AUTH_USER_HEADERS.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(AUTH_USER_HEADERS)] },
    });
    return { headers: Array.from(AUTH_USER_HEADERS), rows: [] };
  }

  const headers = values[0].map((header) => header.trim());
  const missing = AUTH_USER_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `users!${columnLetter(headers.length + 1)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(missing)] },
    });
    headers.push(...missing);
  }
  return { headers, rows: values.slice(1) };
}

function setCell(row: string[], headers: string[], name: string, value: string) {
  const index = column(headers, name);
  if (index !== -1) row[index] = value;
}

export async function getAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const table = await readUserTable();
  const normalized = normalizeEmail(email);
  const matches = table.rows.filter((candidate) => normalizeEmail(cell(candidate, table.headers, 'email')) === normalized);
  if (matches.length > 1) throw new DuplicateAccountError();
  return matches[0] ? rowToUser(matches[0], table.headers) : null;
}

export async function getAuthUserById(id: string): Promise<AuthUser | null> {
  const table = await readUserTable();
  const normalizedId = id.trim();
  const matches = table.rows.filter((candidate) => cell(candidate, table.headers, 'id').trim() === normalizedId);
  if (matches.length > 1) throw new Error('Multiple user accounts have the same ID.');
  return matches[0] ? rowToUser(matches[0], table.headers) : null;
}

let registrationQueue: Promise<unknown> = Promise.resolve();

export async function registerPendingUser(input: RegistrationInput): Promise<{ id: string; email: string; status: 'pending' }> {
  const operation = registrationQueue.then(async () => {
    const table = await readUserTable();
    const email = normalizeEmail(input.email);
    if (table.rows.some((row) => normalizeEmail(cell(row, table.headers, 'email')) === email)) {
      throw new DuplicateAccountError();
    }
    if (table.rows.some((row) => cell(row, table.headers, 'discord_user_id').trim() === input.discordUserId.trim())) {
      throw new DuplicateDiscordIdentityError();
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const roleOption = TEAM_ROLE_OPTIONS.find((option) => option.value === input.teamRole);
    if (!roleOption) throw new Error('Unsupported team role.');
    const values = table.headers.map(() => '');
    setCell(values, table.headers, 'id', id);
    setCell(values, table.headers, 'name', input.name.trim());
    setCell(values, table.headers, 'email', email);
    setCell(values, table.headers, 'role', roleOption.accessRole);
    setCell(values, table.headers, 'status', 'pending');
    setCell(values, table.headers, 'active', 'false');
    setCell(values, table.headers, 'password_hash', input.passwordHash);
    setCell(values, table.headers, 'created_at', now);
    setCell(values, table.headers, 'updated_at', now);
    setCell(values, table.headers, 'team_role', input.teamRole);
    setCell(values, table.headers, 'team_nickname', TEAM_ROLE_NICKNAMES[input.teamRole]);
    setCell(values, table.headers, 'discord_username', input.discordUsername.trim().replace(/^@/, ''));
    setCell(values, table.headers, 'discord_user_id', input.discordUserId.trim());
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: getAccessControlSpreadsheetId(),
      range: `users!A:${columnLetter(table.headers.length)}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
    return { id, email, status: 'pending' as const };
  });
  registrationQueue = operation.catch(() => undefined);
  return operation;
}

export async function recordSuccessfulLogin(user: Pick<AuthUser, 'id' | 'email' | 'role'>): Promise<void> {
  const table = await readUserTable();
  const rowIndex = table.rows.findIndex((candidate) => cell(candidate, table.headers, 'id') === user.id);
  if (rowIndex === -1) return;
  const now = new Date().toISOString();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getAccessControlSpreadsheetId(),
    requestBody: {
      valueInputOption: 'RAW',
      data: ['last_login_at', 'updated_at'].map((field) => ({
        range: `users!${columnLetter(table.headers.indexOf(field) + 1)}${rowIndex + 2}`,
        values: [[now]],
      })),
    },
  });
}
