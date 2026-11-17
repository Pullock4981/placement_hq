import { google, sheets_v4 } from "googleapis";
import { createAppsScriptSheetsClient } from "@/lib/sheets/apps-script-client";
import { SHEET_TAB } from "@/constants";

let sheetsClient: sheets_v4.Sheets | null = null;

function initSheetsClient(): sheets_v4.Sheets {
  if (process.env.GOOGLE_APPS_SCRIPT_URL?.trim() || process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim()) {
    return createAppsScriptSheetsClient();
  }

  const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN?.trim();
  if (refreshToken) {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        "GOOGLE_SHEETS_REFRESH_TOKEN requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET",
      );
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return google.sheets({ version: "v4", auth });
  }

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let credentials: Record<string, unknown> | undefined;
  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON");
    }
  }

  const auth = new google.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClient) {
    sheetsClient = initSheetsClient();
  }
  return sheetsClient;
}

function getRequiredSpreadsheetId(primaryName: string, legacyName = "GOOGLE_SPREADSHEET_ID"): string {
  const id = process.env[primaryName] || process.env[legacyName] || "";
  if (!id) {
    throw new Error(`${primaryName} environment variable is not set`);
  }
  return id;
}

export function getAccessControlSpreadsheetId(): string {
  return process.env.GOOGLE_ACCESS_CONTROL_SPREADSHEET_ID
    || process.env.GOOGLE_CENTRAL_SPREADSHEET_ID
    || getRequiredSpreadsheetId("GOOGLE_ACCESS_CONTROL_SPREADSHEET_ID");
}

export function getSheetManagementSpreadsheetId(): string {
  return process.env.GOOGLE_SHEET_MANAGEMENT_SPREADSHEET_ID
    || process.env.GOOGLE_CENTRAL_SPREADSHEET_ID
    || getRequiredSpreadsheetId("GOOGLE_SHEET_MANAGEMENT_SPREADSHEET_ID");
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID || "";
  if (!id) {
    throw new Error("GOOGLE_SPREADSHEET_ID environment variable is not set");
  }
  return id;
}

function getSpreadsheetIdForSheet(sheetName: string): string {
  if (sheetName === SHEET_TAB.USERS) return getAccessControlSpreadsheetId();
  if (sheetName === SHEET_TAB.REGISTRY || sheetName === SHEET_TAB.LEGACY_REGISTRY || sheetName === SHEET_TAB.BATCHES || sheetName === SHEET_TAB.MENTOR_BATCHES || sheetName === SHEET_TAB.PLACEMENT_FOLLOWUPS) {
    return getSheetManagementSpreadsheetId();
  }
  return getSpreadsheetId();
}

/** @deprecated Use getSpreadsheetId() — kept for backward compatibility */
export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";

export class SheetsApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public sheetName: string,
  ) {
    super(message);
    this.name = "SheetsApiError";
  }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && "code" in error) {
    const code = (error as { code?: number }).code;
    return code === 429 || code === 503 || code === 500;
  }
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  sheetName: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) {
        throw error;
      }
      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        await delay(backoffMs + jitter);
      }
    }
  }
  const status = (lastError as { code?: number })?.code ?? 500;
  throw new SheetsApiError(
    `Sheets API call failed after ${MAX_RETRIES} retries`,
    status,
    sheetName,
  );
}

export async function readSheet(
  sheetName: string,
  skipHeader = true,
): Promise<string[][]> {
  const client = await getSheetsClient();
  return withRetry(async () => {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range: sheetName,
    });
    const rows = response.data.values || [];
    return skipHeader ? rows.slice(1) : rows;
  }, sheetName);
}

export async function sheetExists(sheetName: string): Promise<boolean> {
  try {
    const client = await getSheetsClient();
    const meta = await client.spreadsheets.get({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
    });
    return (
      meta.data.sheets?.some((s) => s.properties?.title === sheetName) || false
    );
  } catch {
    return false;
  }
}

export async function createSheet(
  sheetName: string,
  headers: string[],
): Promise<void> {
  const client = await getSheetsClient();
  return withRetry(async () => {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });

    await client.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });
  }, sheetName);
}

export async function appendRow(
  sheetName: string,
  values: unknown[],
): Promise<void> {
  const client = await getSheetsClient();
  return withRetry(async () => {
    await client.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });
  }, sheetName);
}

export async function appendRows(
  sheetName: string,
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const client = await getSheetsClient();
  return withRetry(async () => {
    await client.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });
  }, sheetName);
}

export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: unknown[],
): Promise<void> {
  if (rowIndex <= 0) {
    throw new SheetsApiError(
      `Invalid rowIndex: ${rowIndex}. Must be > 0`,
      400,
      sheetName,
    );
  }
  const client = await getSheetsClient();
  return withRetry(async () => {
    const range = `${sheetName}!${rowIndex}:${rowIndex}`;
    await client.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });
  }, sheetName);
}

export async function deleteRow(
  sheetName: string,
  rowIndex: number,
): Promise<void> {
  if (rowIndex <= 0) {
    throw new SheetsApiError(
      `Invalid rowIndex: ${rowIndex}. Must be > 0`,
      400,
      sheetName,
    );
  }
  const client = await getSheetsClient();
  return withRetry(async () => {
    const meta = await client.spreadsheets.get({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
    });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );
    if (!sheet?.properties?.sheetId)
      throw new Error(`Sheet "${sheetName}" not found`);

    await client.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
  }, sheetName);
}

export async function findRowIndex(
  sheetName: string,
  columnIndex: number,
  value: string,
): Promise<number> {
  const client = await getSheetsClient();
  return withRetry(async () => {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      range: sheetName,
    });
    const rows = response.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][columnIndex] === value) {
        return i + 1;
      }
    }
    return -1;
  }, sheetName);
}

export async function batchUpdateRows(
  sheetName: string,
  updates: { sheetRow: number; values: unknown[] }[],
): Promise<void> {
  if (updates.length === 0) return;
  const client = await getSheetsClient();
  return withRetry(async () => {
    const requests = updates.map(({ sheetRow, values }) => ({
      range: `${sheetName}!${sheetRow}:${sheetRow}`,
      values: [values],
    }));
    await client.spreadsheets.values.batchUpdate({
      spreadsheetId: getSpreadsheetIdForSheet(sheetName),
      requestBody: {
        valueInputOption: "RAW",
        data: requests,
      },
    });
  }, sheetName);
}
