import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_USER_HEADERS, DuplicateAccountError, DuplicateDiscordIdentityError, getAuthUserByEmail, recordSuccessfulLogin, registerPendingUser } from '@/lib/auth/users';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), append: vi.fn(), batchUpdate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sheets/client', () => ({
  getAccessControlSpreadsheetId: () => 'central-sheet',
  getSheetsClient: async () => ({ spreadsheets: { values: mocks } }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({});
  mocks.append.mockResolvedValue({});
  mocks.batchUpdate.mockResolvedValue({});
});

describe('password users stored through Sheets API', () => {
  it('adds a hash column without rewriting existing Google-era data', async () => {
    const headers = ['id', 'email', 'google_sub', 'name', 'role', 'status', 'active', 'last_login_at', 'created_at', 'updated_at'];
    mocks.get.mockResolvedValue({ data: { values: [headers] } });
    const result = await registerPendingUser({ name: 'New User', email: 'NEW@example.com', passwordHash: 'bcrypt-hash', teamRole: 'technical', discordUsername: 'new.user', discordUserId: '123456789012345678' });
    expect(result).toMatchObject({ email: 'new@example.com', status: 'pending' });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ range: 'users!K1', requestBody: { values: [['password_hash', 'team_role', 'team_nickname', 'discord_username', 'discord_user_id']] } }));
    const values = mocks.append.mock.calls[0][0].requestBody.values[0];
    expect(values[2]).toBe('');
    expect(values[4]).toBe('mentor');
    expect(values[5]).toBe('pending');
    expect(values[6]).toBe('false');
    expect(values[10]).toBe('bcrypt-hash');
    expect(values[11]).toBe('technical');
    expect(values[12]).toBe('Nexen');
    expect(values[13]).toBe('new.user');
    expect(values[14]).toBe('123456789012345678');
  });

  it('rejects normalized duplicate emails without changing the existing row', async () => {
    const row = AUTH_USER_HEADERS.map((header) => header === 'email' ? 'USER@EXAMPLE.COM' : '');
    mocks.get.mockResolvedValue({ data: { values: [Array.from(AUTH_USER_HEADERS), row] } });
    await expect(registerPendingUser({ name: 'New User', email: ' user@example.com ', passwordHash: 'new-hash', teamRole: 'mentor', discordUsername: 'new.user', discordUserId: '123456789012345678' })).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps each Discord user ID bound to only one account', async () => {
    const row = AUTH_USER_HEADERS.map((header) => header === 'discord_user_id' ? '123456789012345678' : header === 'email' ? 'existing@example.com' : '');
    mocks.get.mockResolvedValue({ data: { values: [Array.from(AUTH_USER_HEADERS), row] } });
    await expect(registerPendingUser({ name: 'New User', email: 'new@example.com', passwordHash: 'new-hash', teamRole: 'mentor', discordUsername: 'new.user', discordUserId: '123456789012345678' })).rejects.toBeInstanceOf(DuplicateDiscordIdentityError);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it('reads approval and hashes by header, not by legacy column positions', async () => {
    mocks.get.mockResolvedValue({ data: { values: [Array.from(AUTH_USER_HEADERS), ['user-1', 'Name', 'USER@example.com', 'manager', 'active', 'TRUE', 'old-bcrypt', '', '', '']] } });
    expect(await getAuthUserByEmail('user@example.com')).toMatchObject({ role: 'manager', status: 'active', active: true, password_hash: 'old-bcrypt' });
    await recordSuccessfulLogin({ id: 'user-1', email: 'user@example.com', role: 'manager' });
    const data = mocks.batchUpdate.mock.calls[0][0].requestBody.data;
    expect(data.map((entry: { range: string }) => entry.range)).toEqual(['users!H2', 'users!J2']);
  });
});
