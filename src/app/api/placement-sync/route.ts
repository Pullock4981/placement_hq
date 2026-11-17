import { NextResponse } from 'next/server';
import { createApiError, requireRole } from '@/lib/auth/helpers';
import { DiscordError, discordConfigurationStatus, discordPageCursor, fetchDiscordPlacementPage } from '@/lib/placement-sync/discord';
import { getPlacementStatus, ingestPlacementPage, logPlacementSyncFailure, PlacementSheetsError, setupPlacementWorkbook } from '@/lib/placement-sync/sheets';
import type { PlacementSyncStatus } from '@/lib/placement-sync/types';
import { PlacementSyncSchema } from '@/lib/validators/placement-sync.schema';
import { z } from 'zod';
import { getAppsScriptGatewayInfo, hasAppsScriptSheetsGateway } from '@/lib/sheets/apps-script-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';
const PlacementYearSchema = z.coerce.number().int().min(2020).max(2100);

function getActor(request: Request) {
  const user = requireRole(request.headers, ['manager']);
  if (user.role !== 'manager') throw createApiError('Forbidden', 403);
  return user;
}

function guardWrite(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw createApiError('Demo mode', 403);
  const actor = getActor(request);
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) throw createApiError('Cross-origin request', 403);
  return actor;
}

function errorResponse(error: unknown) {
  if (error instanceof DiscordError) {
    return NextResponse.json({ code: error.code, message: error.message, retryAfter: error.retryAfter }, {
      status: error.status,
      headers: { 'Cache-Control': 'no-store', ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
    });
  }
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in as a manager to access placement sync.' }, { status: 401 });
  if (status === 403) {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    return NextResponse.json({ code: demo ? 'DEMO_MODE' : 'FORBIDDEN', message: demo ? 'Live placement sync is disabled in demo mode.' : 'Placement sync requires a manager and a same-origin request.' }, { status: 403 });
  }
  if (error instanceof PlacementSheetsError) {
    const statuses = { NOT_CONFIGURED: 503, NOT_READY: 409, CONFLICT: 409, GOOGLE_ERROR: 502 } as const;
    return NextResponse.json({ code: error.code, message: error.message }, { status: statuses[error.code] });
  }
  const apiError = error as { code?: number };
  if (apiError.code === 403) return NextResponse.json({ code: 'GOOGLE_ACCESS_DENIED', message: 'The Apps Script deploying account cannot access the Placement workbook. Share it with that Google account as Editor.' }, { status: 503 });
  if (apiError.code === 404) return NextResponse.json({ code: 'GOOGLE_SHEET_NOT_FOUND', message: 'The configured Placement workbook was not found.' }, { status: 503 });
  console.error('[Placement] Google Sheets operation failed:', error);
  const detail = error instanceof Error ? error.message : '';
  return NextResponse.json({ code: 'UPSTREAM_ERROR', message: detail ? `Google Sheets request failed: ${detail}` : 'Google Sheets did not respond. Check the workbook connection and retry.' }, { status: 502 });
}

function withDiscordStatus(status: PlacementSyncStatus, syncSupported: boolean | null = null) {
  const discord = discordConfigurationStatus();
  return {
    ...status,
    discordConfigured: discord.discordConfigured,
    syncSupported,
    missingProperties: [...status.missingProperties.filter((name) => !name.startsWith('DISCORD_')), ...discord.missingProperties],
  };
}

export async function GET(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({ connectionReady: false, sheetsReady: false, discordConfigured: false, missingProperties: ['DEMO_MODE'], spreadsheetTitle: null, spreadsheetUrl: null, masterRows: 0, months: [], recentRecords: [], lastSync: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    getActor(request);
    const parsedYear = PlacementYearSchema.safeParse(new URL(request.url).searchParams.get('year') || new Date().getFullYear());
    if (!parsedYear.success) return NextResponse.json({ code: 'INVALID_YEAR', message: 'Select a valid placement year.' }, { status: 400 });
    const [status, gateway] = await Promise.all([
      getPlacementStatus(parsedYear.data),
      hasAppsScriptSheetsGateway() ? getAppsScriptGatewayInfo().catch(() => null) : Promise.resolve(null),
    ]);
    return NextResponse.json(withDiscordStatus(status, gateway?.placementSyncSupported ?? null), { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = guardWrite(request);
    const parsedYear = PlacementYearSchema.safeParse((await request.json().catch(() => null) as { year?: unknown } | null)?.year);
    if (!parsedYear.success) return NextResponse.json({ code: 'INVALID_YEAR', message: 'Select a valid placement year.' }, { status: 400 });
    return NextResponse.json(withDiscordStatus(await setupPlacementWorkbook(parsedYear.data, actor)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = guardWrite(request);
    const body = await request.json().catch(() => null);
    const input = PlacementSyncSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ code: 'INVALID_REQUEST', message: 'Validation failed', errors: input.error.flatten().fieldErrors }, { status: 400 });
    if (!discordPageCursor(input.data)) return NextResponse.json({ code: 'INVALID_REQUEST', message: 'Sync cursor is outside the requested date range.' }, { status: 400 });
    if (hasAppsScriptSheetsGateway()) {
      let gateway = await getAppsScriptGatewayInfo().catch(() => null);
      if (gateway && !gateway.placementSyncSupported) gateway = await getAppsScriptGatewayInfo(true).catch(() => gateway);
      if (gateway && !gateway.placementSyncSupported) {
        return NextResponse.json({ code: 'APPS_SCRIPT_OUTDATED', message: 'Placement Sync requires Apps Script gateway version 3. Deploy the current Code.gs as a new web-app version, then refresh this page.' }, { status: 409 });
      }
    }
    let discordPage;
    try {
      discordPage = await fetchDiscordPlacementPage(input.data);
    } catch (error) {
      if (error instanceof DiscordError) await logPlacementSyncFailure(input.data, actor.email, error.message).catch((logError) => console.error('[Placement] Could not log Discord failure:', logError));
      throw error;
    }
    return NextResponse.json(await ingestPlacementPage(input.data, actor.email, discordPage), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    guardWrite(request);
    const parsedYear = PlacementYearSchema.safeParse(new URL(request.url).searchParams.get('year') || new Date().getFullYear());
    if (!parsedYear.success) return NextResponse.json({ code: 'INVALID_YEAR', message: 'Select a valid placement year.' }, { status: 400 });
    const discord = discordConfigurationStatus();
    const gateway = hasAppsScriptSheetsGateway() ? await getAppsScriptGatewayInfo(true) : null;
    const status = {
      connectionReady: Boolean(gateway),
      discordConfigured: discord.discordConfigured,
      syncSupported: gateway?.placementSyncSupported ?? false,
    };
    const allReady = status.connectionReady && status.discordConfigured && status.syncSupported;
    return NextResponse.json({
      message: allReady ? 'Google Sheets, Discord, and sync are connected.' : 'Connection setup is incomplete.',
      status,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
