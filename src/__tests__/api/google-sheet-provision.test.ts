import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/google/sheets/provision/route';
import { GOOGLE_OAUTH_SESSION_COOKIE, sealGoogleOAuthSession } from '@/lib/google-oauth/session';

const mocks = vi.hoisted(() => ({ createClients: vi.fn(), provision: vi.fn(), register: vi.fn() }));
vi.mock('@/lib/google-oauth/client', () => ({ createAuthorizedGoogleClients: mocks.createClients }));
vi.mock('@/lib/google-oauth/provision-workbook', () => ({
  GoogleWorkbookProvisionError: class GoogleWorkbookProvisionError extends Error {},
  provisionGoogleWorkbook: mocks.provision,
}));
vi.mock('@/lib/sheets/attachments', () => ({ registerProvisionedWorkbook: mocks.register }));

const managerHeaders = {
  'x-user-id': 'manager-1',
  'x-user-email': 'manager@example.com',
  'x-user-name': 'Manager',
  'x-user-role': 'manager',
};

function request(body: unknown, cookie = '', headers: Record<string, string> = managerHeaders) {
  return new NextRequest('https://app.test/api/google/sheets/provision', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function oauthCookie(placementUserId = 'manager-1') {
  const encrypted = sealGoogleOAuthSession({
    placementUserId,
    email: 'owner@example.com',
    refreshToken: 'refresh-secret',
    scope: 'openid https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
    connectedAt: '2026-09-03T00:00:00.000Z',
  });
  return `${GOOGLE_OAUTH_SESSION_COOKIE}=${encrypted}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('GOOGLE_OAUTH_COOKIE_SECRET', 'test-cookie-secret-with-at-least-32-characters');
  mocks.createClients.mockReturnValue({ sheets: {}, drive: {} });
  mocks.provision.mockResolvedValue({
    spreadsheetId: 'sheet-123',
    title: 'Placement Management',
    template: 'placement_management',
    year: 2026,
    templateLabel: 'Placement Management',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    tabs: ['01_2026', '02_2026', '03_2026', '04_2026', '05_2026', '06_2026', '07_2026', '08_2026', '09_2026', '10_2026', '11_2026', '12_2026', 'placement_sync_log', 'config'],
    createdAt: '2026-09-03T00:00:00.000Z',
  });
  mocks.register.mockResolvedValue({ id: 'registry-1', domain: 'placement_information' });
});
afterEach(() => vi.unstubAllEnvs());

describe('Google Sheet provisioning API', () => {
  it('requires manager authentication and a manager-bound Google session', async () => {
    const unauthenticated = await POST(request({ title: 'Placement Management', template: 'placement_management', year: 2026 }, '', {}));
    expect(unauthenticated.status).toBe(401);
    const disconnected = await POST(request({ title: 'Placement Management', template: 'placement_management', year: 2026 }));
    expect(disconnected.status).toBe(409);
    const anotherManager = await POST(request({ title: 'Placement Management', template: 'placement_management', year: 2026 }, oauthCookie('manager-2')));
    expect(anotherManager.status).toBe(409);
  });

  it('validates the template and title before calling Google', async () => {
    const response = await POST(request({ title: 'x', template: 'unknown' }, oauthCookie()));
    expect(response.status).toBe(400);
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it('creates a workbook through server-side OAuth clients', async () => {
    const response = await POST(request({ title: ' Placement Management ', template: 'placement_management', year: 2026 }, oauthCookie()));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { title: 'Placement Management', year: 2026, tabs: expect.arrayContaining(['01_2026', '12_2026', 'placement_sync_log']) } });
    expect(mocks.createClients).toHaveBeenCalledWith(expect.objectContaining({ placementUserId: 'manager-1', refreshToken: 'refresh-secret' }));
    expect(mocks.provision).toHaveBeenCalledWith(expect.any(Object), { title: 'Placement Management', template: 'placement_management', year: 2026 });
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: 'sheet-123' }), expect.objectContaining({ id: 'manager-1', email: 'manager@example.com' }));
  });

  it('does not run in hosted demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    const response = await POST(request({ title: 'Placement Management', template: 'placement_management', year: 2026 }, oauthCookie()));
    expect(response.status).toBe(403);
    expect(mocks.provision).not.toHaveBeenCalled();
  });
});
