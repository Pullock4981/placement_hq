import type { drive_v3, sheets_v4 } from 'googleapis';
import { getWorkbookTemplate, validateWorkbookTemplate } from '@/lib/google-oauth/workbook-templates';
import type { GoogleSheetProvisionInput } from '@/lib/validators/google-sheet-provision.schema';

interface ProvisionWorkbookClients {
  sheets: sheets_v4.Sheets;
  drive: drive_v3.Drive;
}

export interface ProvisionedWorkbook {
  spreadsheetId: string;
  title: string;
  template: GoogleSheetProvisionInput['template'];
  templateLabel: string;
  year: number | null;
  spreadsheetUrl: string;
  tabs: string[];
  createdAt: string;
  folderName: string | null;
  folderUrl: string | null;
}

export type GoogleWorkbookProvisionStage = 'prepare_folder' | 'create_workbook' | 'write_headers' | 'format_workbook' | 'place_in_folder';

export class GoogleWorkbookProvisionError extends Error {
  readonly stage: GoogleWorkbookProvisionStage;
  readonly googleStatus: number | null;
  readonly googleReason: string | null;

  constructor(stage: GoogleWorkbookProvisionStage, error: unknown) {
    const failure = error as {
      message?: string;
      code?: number | string;
      status?: number;
      response?: { status?: number; data?: { error?: { code?: number; status?: string; message?: string; errors?: Array<{ reason?: string }> } } };
    };
    const googleError = failure.response?.data?.error;
    const statusCandidate = googleError?.code ?? failure.response?.status ?? failure.status ?? failure.code;
    const googleStatus = typeof statusCandidate === 'number' ? statusCandidate : Number.isFinite(Number(statusCandidate)) ? Number(statusCandidate) : null;
    super(googleError?.message ?? failure.message ?? 'Google workbook provisioning failed.');
    this.name = 'GoogleWorkbookProvisionError';
    this.stage = stage;
    this.googleStatus = googleStatus;
    this.googleReason = googleError?.status ?? googleError?.errors?.[0]?.reason ?? null;
  }
}

function driveQueryValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function findOrCreateManagedFolder(drive: drive_v3.Drive, folderName: string) {
  const existing = await drive.files.list({
    q: `name = '${driveQueryValue(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`,
    spaces: 'drive',
    pageSize: 10,
    fields: 'files(id,name,webViewLink)',
  });
  const folder = existing.data.files?.find((file) => file.id);
  if (folder?.id) {
    return { id: folder.id, name: folder.name ?? folderName, url: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`, created: false };
  }
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { placementhq_managed: 'true' },
    },
    fields: 'id,name,webViewLink',
  });
  if (!created.data.id) throw new Error('Google created a folder without returning its ID.');
  return {
    id: created.data.id,
    name: created.data.name ?? folderName,
    url: created.data.webViewLink ?? `https://drive.google.com/drive/folders/${created.data.id}`,
    created: true,
  };
}

export async function provisionGoogleWorkbook(
  clients: ProvisionWorkbookClients,
  input: GoogleSheetProvisionInput,
): Promise<ProvisionedWorkbook> {
  const createdAt = new Date().toISOString();
  const template = validateWorkbookTemplate(getWorkbookTemplate(input.template, createdAt, input.year));
  let spreadsheetId: string | undefined;
  let folder: Awaited<ReturnType<typeof findOrCreateManagedFolder>> | null = null;
  let stage: GoogleWorkbookProvisionStage = input.folderName ? 'prepare_folder' : 'create_workbook';

  try {
    if (input.folderName) folder = await findOrCreateManagedFolder(clients.drive, input.folderName);
    stage = 'create_workbook';
    const created = await clients.sheets.spreadsheets.create({
      requestBody: {
        properties: { title: input.title, locale: 'en_US', timeZone: 'Asia/Dhaka' },
        sheets: template.tabs.map((tab) => ({
          properties: {
            title: tab.title,
            gridProperties: {
              rowCount: 1000,
              columnCount: Math.max(tab.headers.length, 8),
              frozenRowCount: 1,
            },
          },
        })),
      },
      fields: 'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties',
    });

    spreadsheetId = created.data.spreadsheetId ?? undefined;
    if (!spreadsheetId) throw new Error('Google created a workbook without returning its ID.');

    const sheetIds = new Map(
      (created.data.sheets ?? []).flatMap((sheet) => {
        const title = sheet.properties?.title;
        const sheetId = sheet.properties?.sheetId;
        return title && sheetId !== undefined && sheetId !== null ? [[title, sheetId] as const] : [];
      }),
    );
    if (sheetIds.size !== template.tabs.length) throw new Error('Google did not return all created worksheet identifiers.');

    stage = 'write_headers';
    for (const tab of template.tabs) {
      const sheetId = sheetIds.get(tab.title);
      if (sheetId === undefined) throw new Error(`Missing worksheet identifier for ${tab.title}.`);
      const values = [Array.from(tab.headers), ...(tab.rows?.map((row) => Array.from(row)) ?? [])];
      await clients.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateCells: {
                start: { sheetId, rowIndex: 0, columnIndex: 0 },
                rows: values.map((row) => ({
                  values: row.map((value) => ({ userEnteredValue: { stringValue: String(value ?? '') } })),
                })),
                fields: 'userEnteredValue',
              },
            },
          ],
        },
      });
    }

    const requests: sheets_v4.Schema$Request[] = [];
    for (const tab of template.tabs) {
      const sheetId = sheetIds.get(tab.title);
      if (sheetId === undefined) throw new Error(`Missing worksheet identifier for ${tab.title}.`);
      requests.push(
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: tab.headers.length },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.25, blue: 0.55 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 42 },
            fields: 'pixelSize',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: tab.headers.length },
          },
        },
        {
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: tab.headers.length },
              description: 'PlacementHQ managed header row',
              warningOnly: true,
            },
          },
        },
      );
      if (tab.filter) {
        requests.push({
          setBasicFilter: {
            filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: tab.headers.length } },
          },
        });
      }
    }
    requests.push(
      { createDeveloperMetadata: { developerMetadata: { metadataKey: 'placementhq_managed', metadataValue: 'true', visibility: 'DOCUMENT', location: { spreadsheet: true } } } },
      { createDeveloperMetadata: { developerMetadata: { metadataKey: 'placementhq_template', metadataValue: template.id, visibility: 'DOCUMENT', location: { spreadsheet: true } } } },
      { createDeveloperMetadata: { developerMetadata: { metadataKey: 'placementhq_schema_version', metadataValue: '1', visibility: 'DOCUMENT', location: { spreadsheet: true } } } },
    );

    stage = 'format_workbook';
    await clients.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

    if (folder) {
      stage = 'place_in_folder';
      const file = await clients.drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
      await clients.drive.files.update({
        fileId: spreadsheetId,
        addParents: folder.id,
        removeParents: (file.data.parents ?? []).join(','),
        fields: 'id,parents',
      });
    }

    return {
      spreadsheetId,
      title: created.data.properties?.title ?? input.title,
      template: template.id,
      templateLabel: template.label,
      year: input.year ?? null,
      spreadsheetUrl: created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      tabs: template.tabs.map((tab) => tab.title),
      createdAt,
      folderName: folder?.name ?? null,
      folderUrl: folder?.url ?? null,
    };
  } catch (error) {
    if (spreadsheetId) {
      try {
        await clients.drive.files.update({ fileId: spreadsheetId, requestBody: { trashed: true } });
      } catch {}
    }
    if (folder?.created) {
      try {
        await clients.drive.files.update({ fileId: folder.id, requestBody: { trashed: true } });
      } catch {}
    }
    const provisionError = error instanceof GoogleWorkbookProvisionError ? error : new GoogleWorkbookProvisionError(stage, error);
    console.error('Google workbook provisioning failed', {
      stage: provisionError.stage,
      status: provisionError.googleStatus,
      reason: provisionError.googleReason,
      message: provisionError.message,
    });
    throw provisionError;
  }
}
