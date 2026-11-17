import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
const originalSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

describe('Apps Script Sheets client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    process.env.GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/deployment/exec';
    process.env.GOOGLE_APPS_SCRIPT_SECRET = 'test-secret-that-is-at-least-32-characters';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.GOOGLE_APPS_SCRIPT_URL;
    else process.env.GOOGLE_APPS_SCRIPT_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.GOOGLE_APPS_SCRIPT_SECRET;
    else process.env.GOOGLE_APPS_SCRIPT_SECRET = originalSecret;
  });

  it('forwards raw Sheets arguments and unwraps gateway data', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { values: [['id', 'name'], ['1', 'Mou']] },
    }), { status: 200 }));
    const { createAppsScriptSheetsClient } = await import('@/lib/sheets/apps-script-client');
    const client = createAppsScriptSheetsClient();

    const response = await client.spreadsheets.values.get({
      spreadsheetId: 'spreadsheet-id',
      range: 'users!A:B',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    expect(response.data.values).toEqual([['id', 'name'], ['1', 'Mou']]);
    expect(fetch).toHaveBeenCalledOnce();
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request[0]).toBe(process.env.GOOGLE_APPS_SCRIPT_URL);
    expect(JSON.parse(String(request[1]?.body))).toEqual({
      secret: process.env.GOOGLE_APPS_SCRIPT_SECRET,
      action: 'values.get',
      spreadsheetId: 'spreadsheet-id',
      range: 'users!A:B',
      options: { valueRenderOption: 'FORMATTED_VALUE' },
      body: undefined,
    });
  });

  it('preserves a gateway error code for route handling', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: { message: 'Spreadsheet not found (404)', code: 404 },
    }), { status: 200 }));
    const { createAppsScriptSheetsClient } = await import('@/lib/sheets/apps-script-client');
    const client = createAppsScriptSheetsClient();

    await expect(client.spreadsheets.get({ spreadsheetId: 'missing' })).rejects.toMatchObject({
      message: 'Spreadsheet not found (404)',
      code: 404,
    });
  });

  it('sends date-range filters to Apps Script and returns only gateway rows', async () => {
    const values = [['posted_at', 'candidate_name'], ['2026-09-04T10:00:00.000Z', 'Rafi']];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { values } }), { status: 200 }));
    const { queryAppsScriptValuesByDateRange } = await import('@/lib/sheets/apps-script-client');

    await expect(queryAppsScriptValuesByDateRange({
      spreadsheetId: 'spreadsheet-id',
      range: 'placements_master!A:AD',
      dateColumn: 'posted_at',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      timeZone: 'Asia/Dhaka',
    })).resolves.toEqual(values);

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      action: 'values.query',
      spreadsheetId: 'spreadsheet-id',
      range: 'placements_master!A:AD',
      options: {
        dateColumn: 'posted_at',
        fromDate: '2026-09-01',
        toDate: '2026-09-30',
        timeZone: 'Asia/Dhaka',
      },
    });
  });

  it('sends structured filters and pagination to Apps Script', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        values: [['status', 'mentor'], ['active', 'mentor@example.com']],
        query: { totalRows: 40, matchedRows: 8, returnedRows: 1, offset: 5, limit: 1 },
      },
    }), { status: 200 }));
    const { queryAppsScriptValues } = await import('@/lib/sheets/apps-script-client');

    await expect(queryAppsScriptValues({
      spreadsheetId: 'spreadsheet-id',
      range: 'students!A:Z',
      filters: [{ column: 'status', value: 'active' }],
      offset: 5,
      limit: 1,
    })).resolves.toMatchObject({ totalRows: 40, matchedRows: 8, returnedRows: 1 });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      action: 'values.query',
      options: {
        filters: [{ column: 'status', value: 'active' }],
        offset: 5,
        limit: 1,
      },
    });
  });

  it('rejects non-deployment URLs before sending credentials', async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = 'https://example.com/gateway';
    const { createAppsScriptSheetsClient } = await import('@/lib/sheets/apps-script-client');
    const client = createAppsScriptSheetsClient();

    await expect(client.spreadsheets.get({ spreadsheetId: 'spreadsheet-id' })).rejects.toThrow(
      'GOOGLE_APPS_SCRIPT_URL must be a deployed https://script.google.com/.../exec URL',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
