import { describe, expect, it, vi } from 'vitest';
import { provisionGoogleWorkbook } from '@/lib/google-oauth/provision-workbook';
import { MONTHLY_KPI_HEADERS, PLACEMENT_SYNC_LOG_HEADERS, PLACEMENT_WORKBOOK_HEADERS, QUARTERLY_OKR_HEADERS, SCRUM_SYNC_LOG_HEADERS, SCRUM_UPDATE_HEADERS } from '@/lib/google-oauth/workbook-templates';

function clients() {
  const create = vi.fn().mockResolvedValue({
    data: {
      spreadsheetId: 'sheet-123',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
      properties: { title: 'Placement Management' },
      sheets: [...Array.from({ length: 12 }, (_, index) => ({ properties: { title: `${String(index + 1).padStart(2, '0')}_2026`, sheetId: index + 1 } })), { properties: { title: 'placement_sync_log', sheetId: 20 } }, { properties: { title: 'config', sheetId: 30 } }],
    },
  });
  const valuesBatchUpdate = vi.fn().mockResolvedValue({ data: {} });
  const batchUpdate = vi.fn().mockResolvedValue({ data: {} });
  const listFolders = vi.fn().mockResolvedValue({ data: { files: [] } });
  const createFolder = vi.fn().mockResolvedValue({ data: { id: 'folder-123', name: 'PlacementHQ', webViewLink: 'https://drive.google.com/drive/folders/folder-123' } });
  const getFile = vi.fn().mockResolvedValue({ data: { parents: ['root'] } });
  const trash = vi.fn().mockResolvedValue({ data: {} });
  return {
    mocks: { create, valuesBatchUpdate, batchUpdate, listFolders, createFolder, getFile, trash },
    value: {
      sheets: { spreadsheets: { create, values: { batchUpdate: valuesBatchUpdate }, batchUpdate } },
      drive: { files: { list: listFolders, create: createFolder, get: getFile, update: trash } },
    },
  };
}

describe('Google workbook provisioning', () => {
  it('creates the placement workbook with exact managed headers and formatting', async () => {
    const testClients = clients();
    const result = await provisionGoogleWorkbook(testClients.value as never, {
      title: 'Placement Management',
      template: 'placement_management',
      year: 2026,
    });

    expect(result).toMatchObject({
      title: 'Placement Management',
      template: 'placement_management',
      tabs: expect.arrayContaining(['01_2026', '12_2026', 'placement_sync_log', 'config']),
    });
    expect(testClients.mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        properties: expect.objectContaining({ timeZone: 'Asia/Dhaka' }),
        sheets: expect.arrayContaining([
          expect.objectContaining({ properties: expect.objectContaining({ title: '01_2026', gridProperties: expect.objectContaining({ frozenRowCount: 1 }) }) }),
        ]),
      }),
    }));
    const valueRequest = testClients.mocks.valuesBatchUpdate.mock.calls[0][0].requestBody.data;
    expect(valueRequest[0].values[0]).toEqual(Array.from(PLACEMENT_WORKBOOK_HEADERS));
    expect(valueRequest[11].values[0]).toEqual(Array.from(PLACEMENT_WORKBOOK_HEADERS));
    expect(valueRequest[12].values[0]).toEqual(Array.from(PLACEMENT_SYNC_LOG_HEADERS));
    expect(valueRequest[13].values).toEqual(expect.arrayContaining([expect.arrayContaining(['placement_year', '2026'])]));
    const formatRequests = testClients.mocks.batchUpdate.mock.calls[0][0].requestBody.requests;
    expect(formatRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ addProtectedRange: expect.any(Object) }),
      expect.objectContaining({ setBasicFilter: expect.any(Object) }),
      expect.objectContaining({ createDeveloperMetadata: expect.objectContaining({ developerMetadata: expect.objectContaining({ metadataKey: 'placementhq_template', metadataValue: 'placement_management' }) }) }),
    ]));
    expect(testClients.mocks.trash).not.toHaveBeenCalled();
  });

  it('trashes a newly created workbook when setup fails', async () => {
    const testClients = clients();
    testClients.mocks.valuesBatchUpdate.mockRejectedValueOnce(new Error('Google write failed'));

    await expect(provisionGoogleWorkbook(testClients.value as never, {
      title: 'Placement Management',
      template: 'placement_management',
      year: 2026,
    })).rejects.toThrow('Google write failed');
    expect(testClients.mocks.trash).toHaveBeenCalledWith({ fileId: 'sheet-123', requestBody: { trashed: true } });
  });

  it('creates the complete central system template', async () => {
    const testClients = clients();
    testClients.mocks.create.mockResolvedValueOnce({
      data: {
        spreadsheetId: 'central-123',
        properties: { title: 'PlacementHQ - DBMS' },
        sheets: ['users', 'batches', 'sheets', 'audit_log', 'system_config'].map((title, index) => ({ properties: { title, sheetId: index + 1 } })),
      },
    });
    const result = await provisionGoogleWorkbook(testClients.value as never, {
      title: 'PlacementHQ - DBMS',
      template: 'central_system',
    });
    expect(result.tabs).toEqual(['users', 'batches', 'sheets', 'audit_log', 'system_config']);
  });

  it('creates a complete annual Scrum workbook with weekly tabs', async () => {
    const testClients = clients();
    testClients.mocks.create.mockResolvedValueOnce({
      data: {
        spreadsheetId: 'scrum-123',
        properties: { title: 'Daily Scrum Management 2026' },
        sheets: [
          ...Array.from({ length: 53 }, (_, index) => ({ properties: { title: `W${String(index + 1).padStart(2, '0')}_2026`, sheetId: index + 1 } })),
          { properties: { title: 'scrum_sync_log', sheetId: 60 } },
          { properties: { title: 'config', sheetId: 61 } },
        ],
      },
    });

    const result = await provisionGoogleWorkbook(testClients.value as never, {
      title: 'Daily Scrum Management 2026',
      template: 'scrum_management',
      year: 2026,
    });

    expect(result.tabs).toHaveLength(55);
    expect(result.tabs).toEqual(expect.arrayContaining(['W01_2026', 'W53_2026', 'scrum_sync_log', 'config']));
    const valueRequest = testClients.mocks.valuesBatchUpdate.mock.calls[0][0].requestBody.data;
    expect(valueRequest[0].values[0]).toEqual(Array.from(SCRUM_UPDATE_HEADERS));
    expect(valueRequest[52].values[0]).toEqual(Array.from(SCRUM_UPDATE_HEADERS));
    expect(valueRequest[53].values[0]).toEqual(Array.from(SCRUM_SYNC_LOG_HEADERS));
    expect(valueRequest[54].values).toEqual(expect.arrayContaining([expect.arrayContaining(['reporting_year', '2026'])]));
  });

  it('creates the performance workbook with KPI and OKR tabs', async () => {
    const testClients = clients();
    testClients.mocks.create.mockResolvedValueOnce({
      data: {
        spreadsheetId: 'performance-123',
        properties: { title: 'PlacementHQ Performance' },
        sheets: ['monthly_kpis', 'quarterly_okrs', 'config'].map((title, index) => ({ properties: { title, sheetId: index + 1 } })),
      },
    });

    const result = await provisionGoogleWorkbook(testClients.value as never, {
      title: 'PlacementHQ Performance',
      template: 'performance_management',
    });

    expect(result.tabs).toEqual(['monthly_kpis', 'quarterly_okrs', 'config']);
    const valueRequest = testClients.mocks.valuesBatchUpdate.mock.calls[0][0].requestBody.data;
    expect(valueRequest[0].values[0]).toEqual(Array.from(MONTHLY_KPI_HEADERS));
    expect(valueRequest[1].values[0]).toEqual(Array.from(QUARTERLY_OKR_HEADERS));
    expect(valueRequest[2].values).toEqual(expect.arrayContaining([expect.arrayContaining(['template', 'performance_management'])]));
  });

  it('creates a managed Drive folder and moves the workbook into it', async () => {
    const testClients = clients();
    const result = await provisionGoogleWorkbook(testClients.value as never, {
      title: 'Placement Management',
      template: 'placement_management',
      year: 2026,
      folderName: 'PlacementHQ',
    });

    expect(testClients.mocks.listFolders).toHaveBeenCalledWith(expect.objectContaining({ spaces: 'drive' }));
    expect(testClients.mocks.createFolder).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({ name: 'PlacementHQ', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] }),
    }));
    expect(testClients.mocks.trash).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'sheet-123',
      addParents: 'folder-123',
      removeParents: 'root',
    }));
    expect(result).toMatchObject({ folderName: 'PlacementHQ', folderUrl: 'https://drive.google.com/drive/folders/folder-123' });
  });
});
