import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  oauthArguments: [] as unknown[][],
  setCredentials: vi.fn(),
  sheets: vi.fn(() => ({ spreadsheets: {} })),
  googleAuth: vi.fn(),
  appsScriptClient: { spreadsheets: { values: {} } },
  createAppsScriptSheetsClient: vi.fn(),
}));

vi.mock('googleapis', () => {
  class OAuth2 {
    constructor(...args: unknown[]) {
      mocks.oauthArguments.push(args);
    }

    setCredentials = mocks.setCredentials;
  }

  return {
    google: {
      auth: { OAuth2, GoogleAuth: mocks.googleAuth },
      sheets: mocks.sheets,
    },
  };
});

vi.mock('@/lib/sheets/apps-script-client', () => ({
  createAppsScriptSheetsClient: mocks.createAppsScriptSheetsClient,
}));

const names = [
  'GOOGLE_APPS_SCRIPT_URL',
  'GOOGLE_APPS_SCRIPT_SECRET',
  'GOOGLE_SHEETS_REFRESH_TOKEN',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
] as const;

const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

describe('Google Sheets backend authorization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.oauthArguments.length = 0;
    mocks.createAppsScriptSheetsClient.mockReturnValue(mocks.appsScriptClient);
    for (const name of names) delete process.env[name];
  });

  it('uses the Apps Script gateway before other Google credentials', async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/deployment/exec';
    process.env.GOOGLE_APPS_SCRIPT_SECRET = 'a'.repeat(32);
    process.env.GOOGLE_SHEETS_REFRESH_TOKEN = 'refresh-token';

    const { getSheetsClient } = await import('@/lib/sheets/client');

    await expect(getSheetsClient()).resolves.toBe(mocks.appsScriptClient);
    expect(mocks.createAppsScriptSheetsClient).toHaveBeenCalledOnce();
    expect(mocks.sheets).not.toHaveBeenCalled();
  });

  afterEach(() => {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('uses an OAuth refresh token without a service-account key', async () => {
    process.env.GOOGLE_SHEETS_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';

    const { getSheetsClient } = await import('@/lib/sheets/client');
    await getSheetsClient();

    expect(mocks.oauthArguments).toEqual([['client-id', 'client-secret']]);
    expect(mocks.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
    expect(mocks.googleAuth).not.toHaveBeenCalled();
    expect(mocks.sheets).toHaveBeenCalledWith(expect.objectContaining({ version: 'v4' }));
  });

  it('fails clearly when refresh-token client credentials are incomplete', async () => {
    process.env.GOOGLE_SHEETS_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';

    const { getSheetsClient } = await import('@/lib/sheets/client');

    await expect(getSheetsClient()).rejects.toThrow(
      'GOOGLE_SHEETS_REFRESH_TOKEN requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET',
    );
    expect(mocks.sheets).not.toHaveBeenCalled();
  });
});
