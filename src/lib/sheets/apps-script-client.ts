import type { sheets_v4 } from 'googleapis';

type GatewayAction =
  | 'values.get'
  | 'values.batchGet'
  | 'values.update'
  | 'values.append'
  | 'values.batchUpdate'
  | 'values.query'
  | 'values.queryDateRange'
  | 'placement.syncPage'
  | 'spreadsheets.get'
  | 'spreadsheets.batchUpdate';

interface GatewayResponse {
  ok: boolean;
  data?: unknown;
  error?: { message?: string; code?: number };
}

let gatewayInfoCache: { version: number; placementSyncSupported: boolean; expiresAt: number } | null = null;
let gatewayInfoRequest: Promise<{ version: number; placementSyncSupported: boolean }> | null = null;

function gatewayConfiguration() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim();
  if (!url || !secret) throw new Error('GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET are required together');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
    throw new Error('GOOGLE_APPS_SCRIPT_URL must be a deployed https://script.google.com/.../exec URL');
  }
  if (secret.length < 32) throw new Error('GOOGLE_APPS_SCRIPT_SECRET must contain at least 32 characters');
  return { url, secret };
}

async function callGateway(action: GatewayAction, args: Record<string, unknown>) {
  const { url, secret } = gatewayConfiguration();
  const { spreadsheetId, range, requestBody, ...options } = args;
  const controller = new AbortController();
  const timeoutMs = action === 'placement.syncPage' ? 55_000 : 45_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, action, spreadsheetId, range, options, body: requestBody }),
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error(`Apps Script gateway returned HTTP ${response.status}`), { code: response.status });
    const payload = await response.json() as GatewayResponse;
    if (!payload.ok) {
      throw Object.assign(new Error(payload.error?.message || 'Apps Script gateway request failed'), { code: payload.error?.code ?? 500 });
    }
    return { data: payload.data ?? {} };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw Object.assign(new Error('Apps Script gateway timed out'), { code: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface DateRangeValuesQuery {
  spreadsheetId: string;
  range: string;
  dateColumn: string;
  fromDate: string;
  toDate: string;
  timeZone?: string;
}

export type SheetQueryFilter = {
  column: string;
  operator?: 'equals' | 'notEquals' | 'contains' | 'in';
  value: string | number | boolean | string[];
};

export interface SheetValuesQuery {
  spreadsheetId: string;
  range: string;
  dateColumn?: string;
  fromDate?: string;
  toDate?: string;
  timeZone?: string;
  filters?: SheetQueryFilter[];
  offset?: number;
  limit?: number;
}

export interface SheetValuesQueryResult {
  values: unknown[][];
  totalRows: number;
  matchedRows: number;
  returnedRows: number;
  offset: number;
  limit: number;
}

export function hasAppsScriptSheetsGateway() {
  return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL?.trim() && process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim());
}

export async function getAppsScriptGatewayInfo(forceRefresh = false) {
  if (forceRefresh) gatewayInfoCache = null;
  if (gatewayInfoCache && gatewayInfoCache.expiresAt > Date.now()) return gatewayInfoCache;
  if (gatewayInfoRequest) return gatewayInfoRequest;
  const { url } = gatewayConfiguration();
  gatewayInfoRequest = (async () => {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Apps Script gateway returned HTTP ${response.status}`);
    const payload = await response.json() as { ok?: boolean; version?: number; capabilities?: { placementSyncPage?: boolean } };
    const value = {
      version: Number(payload.version || 0),
      placementSyncSupported: payload.capabilities?.placementSyncPage === true || Number(payload.version || 0) >= 3,
    };
    gatewayInfoCache = { ...value, expiresAt: Date.now() + 60_000 };
    return value;
  })();
  try {
    return await gatewayInfoRequest;
  } finally {
    gatewayInfoRequest = null;
  }
}

export async function syncPlacementPageWithAppsScript(input: {
  centralSpreadsheetId: string;
  year: number;
  placementHeaders: readonly string[];
  logHeaders: readonly string[];
  records: Array<Record<string, string>>;
  log: Record<string, string | number>;
}) {
  try {
    const response = await callGateway('placement.syncPage', {
      spreadsheetId: input.centralSpreadsheetId,
      requestBody: input,
    });
    return response.data as { inserted: number; updated: number; unchanged: number; invalid: number };
  } catch (error) {
    if (error instanceof Error && /unsupported action/i.test(error.message)) {
      throw new Error('The Apps Script deployment is outdated. Replace Code.gs with the project version and deploy a new web-app version.');
    }
    throw error;
  }
}

export async function queryAppsScriptValues(query: SheetValuesQuery): Promise<SheetValuesQueryResult> {
  const response = await callGateway('values.query', { ...query });
  const data = response.data as sheets_v4.Schema$ValueRange & {
    query?: Omit<SheetValuesQueryResult, 'values'>;
  };
  const values = data.values ?? [];
  const returnedRows = Math.max(0, values.length - 1);
  return {
    values,
    totalRows: data.query?.totalRows ?? returnedRows,
    matchedRows: data.query?.matchedRows ?? returnedRows,
    returnedRows: data.query?.returnedRows ?? returnedRows,
    offset: data.query?.offset ?? 0,
    limit: data.query?.limit ?? returnedRows,
  };
}

export async function queryAppsScriptValuesByDateRange(query: DateRangeValuesQuery): Promise<unknown[][]> {
  const result = await queryAppsScriptValues(query);
  return result.values;
}

export function createAppsScriptSheetsClient(): sheets_v4.Sheets {
  return {
    spreadsheets: {
      values: {
        get: (args: unknown) => callGateway('values.get', args as Record<string, unknown>),
        batchGet: (args: unknown) => callGateway('values.batchGet', args as Record<string, unknown>),
        update: (args: unknown) => callGateway('values.update', args as Record<string, unknown>),
        append: (args: unknown) => callGateway('values.append', args as Record<string, unknown>),
        batchUpdate: (args: unknown) => callGateway('values.batchUpdate', args as Record<string, unknown>),
      },
      get: (args: unknown) => callGateway('spreadsheets.get', args as Record<string, unknown>),
      batchUpdate: (args: unknown) => callGateway('spreadsheets.batchUpdate', args as Record<string, unknown>),
    },
  } as unknown as sheets_v4.Sheets;
}
