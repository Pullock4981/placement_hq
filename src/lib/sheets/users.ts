import { getAccessControlSpreadsheetId, getSheetsClient } from './client';
import type { TeamRole, User, UserRole, UserStatus } from '@/types';
import { TEAM_ROLES, USER_ROLES, USER_STATUSES } from '@/constants';

const USERS_CACHE: { data: User[]; timestamp: number } = { data: [], timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

function value(row: string[], headers: string[], name: string) {
  const index = headers.indexOf(name);
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

function rowToUser(row: string[], headers: string[]): User {
  const role = value(row, headers, 'role').trim().toLowerCase() as UserRole;
  const status = value(row, headers, 'status').trim().toLowerCase() as UserStatus;
  const teamRole = value(row, headers, 'team_role').trim().toLowerCase() as TeamRole;
  return {
    id: value(row, headers, 'id'),
    name: value(row, headers, 'name'),
    email: value(row, headers, 'email').trim().toLowerCase(),
    role: USER_ROLES.includes(role) ? role : 'mentor',
    status: USER_STATUSES.includes(status) ? status : 'pending',
    active: ['true', 'yes', '1'].includes(value(row, headers, 'active').trim().toLowerCase()),
    team_role: TEAM_ROLES.includes(teamRole) ? teamRole : undefined,
    team_nickname: value(row, headers, 'team_nickname'),
    discord_username: value(row, headers, 'discord_username'),
    discord_user_id: value(row, headers, 'discord_user_id'),
  };
}

async function fetchUsers(): Promise<User[]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: getAccessControlSpreadsheetId(), range: 'users!A:ZZ' });
  const values = (response.data.values ?? []).map((row) => row.map((entry) => String(entry ?? '')));
  const headers = values[0] ?? [];
  return values.slice(1).map((row) => rowToUser(row, headers)).filter((user) => user.id && user.email);
}

async function cachedUsers() {
  const now = Date.now();
  if (USERS_CACHE.data.length === 0 || now - USERS_CACHE.timestamp > CACHE_TTL_MS) {
    USERS_CACHE.data = await fetchUsers();
    USERS_CACHE.timestamp = now;
  }
  return USERS_CACHE.data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  return (await cachedUsers()).find((user) => user.email === normalized) ?? null;
}

export async function getAllUsers(): Promise<User[]> {
  return cachedUsers();
}

export async function getAllUsersForAdmin(): Promise<User[]> {
  return fetchUsers();
}

export async function updateUserAccess(id: string, input: { role: UserRole; status: UserStatus; active: boolean }): Promise<User> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getAccessControlSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'users!A:ZZ' });
  const values = (response.data.values ?? []).map((row) => row.map((entry) => String(entry ?? '')));
  const headers = values[0] ?? [];
  const rowIndex = values.slice(1).findIndex((row) => value(row, headers, 'id') === id);
  if (rowIndex === -1) throw new Error('User not found.');
  const updatedAtIndex = headers.indexOf('updated_at');
  const updates = [
    { field: 'role', value: input.role },
    { field: 'status', value: input.status },
    { field: 'active', value: input.active ? 'true' : 'false' },
    ...(updatedAtIndex === -1 ? [] : [{ field: 'updated_at', value: new Date().toISOString() }]),
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates.map((update) => ({
        range: `users!${columnLetter(headers.indexOf(update.field) + 1)}${rowIndex + 2}`,
        values: [[update.value]],
      })),
    },
  });
  invalidateUsersCache();
  const row = [...values[rowIndex + 1]];
  updates.forEach((update) => { row[headers.indexOf(update.field)] = update.value; });
  return rowToUser(row, headers);
}

export function invalidateUsersCache(): void {
  USERS_CACHE.data = [];
  USERS_CACHE.timestamp = 0;
}
