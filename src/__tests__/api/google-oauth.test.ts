import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as callback } from '@/app/api/google/oauth/callback/route';
import { GET as connect } from '@/app/api/google/oauth/connect/route';
import { POST as disconnect } from '@/app/api/google/oauth/disconnect/route';
import { GET as status } from '@/app/api/google/oauth/status/route';
import { POST as testConnection } from '@/app/api/google/oauth/test/route';
import { GOOGLE_OAUTH_SESSION_COOKIE, GOOGLE_OAUTH_STATE_COOKIE, sealGoogleOAuthSession } from '@/lib/google-oauth/session';

const mocks = vi.hoisted(() => ({ missing: vi.fn(), authorizationUrl: vi.fn(), exchange: vi.fn(), verify: vi.fn(), revoke: vi.fn() }));
vi.mock('@/lib/google-oauth/client', () => ({
  GOOGLE_OAUTH_SCOPES: ['openid', 'email', 'spreadsheets', 'drive.file'],
  missingGoogleOAuthConfiguration: mocks.missing,
  createGoogleAuthorizationUrl: mocks.authorizationUrl,
  exchangeGoogleAuthorizationCode: mocks.exchange,
  verifyGoogleOAuthSession: mocks.verify,
  revokeGoogleOAuthSession: mocks.revoke,
}));

const managerHeaders = { 'x-user-id': 'manager-1', 'x-user-email': 'manager@example.com', 'x-user-name': 'Manager', 'x-user-role': 'manager' };
function request(url: string, cookie = '') {
  return new NextRequest(url, { headers: { ...managerHeaders, ...(cookie ? { cookie } : {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('GOOGLE_OAUTH_COOKIE_SECRET', 'test-cookie-secret-with-at-least-32-characters');
  mocks.missing.mockReturnValue([]);
  mocks.authorizationUrl.mockImplementation((state: string) => `https://accounts.google.test/authorize?state=${state}`);
  mocks.exchange.mockResolvedValue({ email: 'owner@example.com', refreshToken: 'refresh-secret', scope: 'openid email', connectedAt: '2026-09-02T00:00:00.000Z' });
  mocks.verify.mockResolvedValue({ email: 'owner@example.com' });
  mocks.revoke.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('Google OAuth API foundation', () => {
  it('requires manager authentication and reports missing server configuration', async () => {
    expect((await connect(new NextRequest('https://app.test/api/google/oauth/connect'))).status).toBe(401);
    mocks.missing.mockReturnValue(['GOOGLE_OAUTH_CLIENT_ID']);
    const response = await status(request('https://app.test/api/google/oauth/status'));
    expect(await response.json()).toMatchObject({ configured: false, connected: false, backend: 'google_apis' });
  });

  it('stays disconnected and blocks consent in hosted demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    const statusResponse = await status(new NextRequest('https://app.test/api/google/oauth/status'));
    expect(await statusResponse.json()).toMatchObject({ configured: false, connected: false, demoMode: true, backend: 'google_apis' });
    expect((await connect(new NextRequest('https://app.test/api/google/oauth/connect'))).status).toBe(403);
  });

  it('starts consent with a short-lived HTTP-only state cookie', async () => {
    const response = await connect(request('https://app.test/api/google/oauth/connect'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('https://accounts.google.test/authorize');
    expect(response.headers.get('set-cookie')).toContain(`${GOOGLE_OAUTH_STATE_COOKIE}=`);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('exchanges a valid callback and exposes only safe connection status', async () => {
    const state = 'valid-oauth-state';
    const response = await callback(request(`https://app.test/api/google/oauth/callback?code=authorization-code&state=${state}`, `${GOOGLE_OAUTH_STATE_COOKIE}=${state}`));
    expect(response.headers.get('location')).toBe('https://app.test/manager/sheets?google_oauth=connected');
    expect(response.headers.get('set-cookie')).toContain(`${GOOGLE_OAUTH_SESSION_COOKIE}=`);
    expect(response.headers.get('set-cookie')).not.toContain('refresh-secret');

    const encrypted = sealGoogleOAuthSession({ placementUserId: 'manager-1', email: 'owner@example.com', refreshToken: 'refresh-secret', scope: 'openid email', connectedAt: '2026-09-02T00:00:00.000Z' });
    const statusResponse = await status(request('https://app.test/api/google/oauth/status', `${GOOGLE_OAUTH_SESSION_COOKIE}=${encrypted}`));
    expect(await statusResponse.json()).toMatchObject({ configured: true, connected: true, email: 'owner@example.com', backend: 'google_apis' });

    const testResponse = await testConnection(request('https://app.test/api/google/oauth/test', `${GOOGLE_OAUTH_SESSION_COOKIE}=${encrypted}`));
    expect(testResponse.status).toBe(200);
    expect(await testResponse.json()).toMatchObject({ ok: true, email: 'owner@example.com' });
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ placementUserId: 'manager-1', refreshToken: 'refresh-secret' }));
  });

  it('rejects invalid callback state and clears the session on disconnect', async () => {
    const rejected = await callback(request('https://app.test/api/google/oauth/callback?code=code&state=wrong', `${GOOGLE_OAUTH_STATE_COOKIE}=expected`));
    expect(rejected.headers.get('location')).toContain('google_oauth=failed');
    expect(mocks.exchange).not.toHaveBeenCalled();
    const encrypted = sealGoogleOAuthSession({ placementUserId: 'manager-1', email: 'owner@example.com', refreshToken: 'refresh-secret', scope: 'openid email', connectedAt: '2026-09-02T00:00:00.000Z' });
    const response = await disconnect(request('https://app.test/api/google/oauth/disconnect', `${GOOGLE_OAUTH_SESSION_COOKIE}=${encrypted}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`${GOOGLE_OAUTH_SESSION_COOKIE}=`);
    expect(mocks.revoke).toHaveBeenCalled();
  });

  it('does not expose a Google connection across PlacementHQ manager accounts', async () => {
    const encrypted = sealGoogleOAuthSession({ placementUserId: 'another-manager', email: 'owner@example.com', refreshToken: 'refresh-secret', scope: 'openid email', connectedAt: '2026-09-02T00:00:00.000Z' });
    const response = await status(request('https://app.test/api/google/oauth/status', `${GOOGLE_OAUTH_SESSION_COOKIE}=${encrypted}`));
    expect(await response.json()).toMatchObject({ connected: false, email: null });
    expect(response.headers.get('set-cookie')).toContain(`${GOOGLE_OAUTH_SESSION_COOKIE}=`);
  });
});
