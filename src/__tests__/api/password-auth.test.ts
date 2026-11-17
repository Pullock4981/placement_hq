import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as register } from '@/app/api/auth/register/route';
import { DuplicateAccountError } from '@/lib/auth/users';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), register: vi.fn(), record: vi.fn(), compare: vi.fn(), hash: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/auth/users', () => ({
  getAuthUserByEmail: mocks.lookup,
  registerPendingUser: mocks.register,
  recordSuccessfulLogin: mocks.record,
  DuplicateAccountError: class extends Error {},
  DuplicateDiscordIdentityError: class extends Error {},
}));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
vi.mock('@/lib/auth/jwt', () => ({ signAccessToken: () => 'access-token', signRefreshToken: () => 'refresh-token' }));
vi.mock('@/lib/security/rate-limit-middleware', () => ({ rateLimitLogin: mocks.limit }));

function request(path: string, body: unknown, origin = 'http://localhost:3000') {
  return new Request(`${origin}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
}

const input = { name: 'Test User', email: 'user@example.com', password: 'SecurePass123', teamRole: 'technical', discordUsername: 'test.user', discordUserId: '123456789012345678', role: 'mentor' };
const user = { id: 'user-1', name: input.name, email: input.email, role: 'manager', status: 'active', active: true, password_hash: 'stored-hash' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
  mocks.lookup.mockResolvedValue(user);
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue('new-password-hash');
  mocks.register.mockResolvedValue({ id: 'user-1', email: input.email, status: 'pending' });
  mocks.record.mockResolvedValue(undefined);
  mocks.limit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());

describe('email/password authentication', () => {
  it('registers a pending account using only a bcrypt hash', async () => {
    const response = await register(request('register', { ...input, email: ' MANAGER@EXAMPLE.COM ', active: true, status: 'active' }));
    expect(response.status).toBe(201);
    expect(mocks.hash).toHaveBeenCalledWith(input.password, 12);
    expect(mocks.register).toHaveBeenCalledWith({ name: input.name, email: 'manager@example.com', passwordHash: 'new-password-hash', teamRole: 'technical', discordUsername: input.discordUsername, discordUserId: input.discordUserId });
    expect(await response.text()).not.toContain('new-password-hash');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each(['admin', 'manager', 'student'])('ignores a public request for the %s role', async (role) => {
    expect((await register(request('register', { ...input, role }))).status).toBe(201);
    expect(mocks.register).toHaveBeenCalledWith({ name: input.name, email: input.email, passwordHash: 'new-password-hash', teamRole: 'technical', discordUsername: input.discordUsername, discordUserId: input.discordUserId });
  });

  it('does not allow Manager to be requested through public registration', async () => {
    const response = await register(request('register', { ...input, teamRole: 'manager' }));
    expect(response.status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing email account', async () => {
    mocks.register.mockRejectedValue(new DuplicateAccountError());
    expect((await register(request('register', input))).status).toBe(409);
  });

  it('reports missing Google Sheets server authorization clearly', async () => {
    vi.stubEnv('GOOGLE_SHEETS_REFRESH_TOKEN', '');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '');
    mocks.register.mockRejectedValue(new Error('Could not load the default credentials'));

    const response = await register(request('register', input));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'GOOGLE_SHEETS_AUTH_REQUIRED' });
  });

  it('rejects passwords beyond the bcrypt UTF-8 byte limit', async () => {
    expect((await register(request('register', { ...input, password: `Aa1${'😀'.repeat(20)}` }))).status).toBe(400);
    expect(mocks.hash).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'pending', active: false },
    { status: 'active', active: false },
    { status: 'suspended', active: true },
  ])('rejects unapproved or disabled accounts: %o', async (approval) => {
    mocks.lookup.mockResolvedValue({ ...user, ...approval });
    const response = await login(request('login', input));
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects incorrect credentials before revealing account status', async () => {
    mocks.lookup.mockResolvedValue({ ...user, status: 'pending' });
    mocks.compare.mockResolvedValue(false);
    expect((await login(request('login', input))).status).toBe(401);
  });

  it('does not allow a Google-only row without a password hash to log in', async () => {
    mocks.lookup.mockResolvedValue({ ...user, password_hash: '' });
    expect((await login(request('login', input))).status).toBe(401);
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:3000', 'https://placement.example.com'])('logs in an approved account on %s', async (origin) => {
    const response = await login(request('login', input, origin));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, redirectTo: '/manager' });
    expect(response.headers.get('set-cookie')).toContain('access_token=access-token');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')?.includes('Secure')).toBe(origin.startsWith('https:'));
  });

  it('enforces rate limiting before looking up credentials', async () => {
    mocks.limit.mockResolvedValue({ allowed: false, response: new Response('{}', { status: 429 }) });
    expect((await login(request('login', input))).status).toBe(429);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('blocks live registration in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    expect((await register(request('register', input))).status).toBe(403);
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
