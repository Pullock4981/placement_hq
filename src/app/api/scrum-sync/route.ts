import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiError, requireRole } from '@/lib/auth/helpers';
import { DiscordError } from '@/lib/placement-sync/discord';
import { fetchScrumPage, scrumCursor, scrumDiscordConfigurationStatus } from '@/lib/scrum-sync/discord';
import { ensureScrumWorkbookReady, getScrumConnectionStatus, getScrumDashboard, ingestScrumPage, ScrumSheetsError, setupScrumWorkbook } from '@/lib/scrum-sync/sheets';
import { ScrumSyncSchema } from '@/lib/validators/scrum-sync.schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const dashboardQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employee: z.string().optional(),
});

function actor(request: Request) {
  const user = requireRole(request.headers, ['manager']);
  if (user.role !== 'manager') throw createApiError('Forbidden', 403);
  return user;
}

function writeActor(request: Request) {
  const user = actor(request);
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') throw createApiError('Demo mode', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw createApiError('Cross-origin request', 403);
  return user;
}

function errorResponse(error: unknown) {
  if (error instanceof DiscordError) return NextResponse.json({ code: error.code, message: error.message, retryAfter: error.retryAfter }, { status: error.status });
  if (error instanceof ScrumSheetsError) {
    const status = error.code === 'NOT_CONFIGURED' ? 503 : error.code === 'GOOGLE_ERROR' ? 502 : 409;
    return NextResponse.json({ code: error.code, message: error.message }, { status });
  }
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
  if (status === 401 || status === 403) return NextResponse.json({ message: status === 401 ? 'Sign in as a manager.' : 'Manager access is required.' }, { status });
  console.error('[Scrum Sync] Request failed:', error);
  const message = error instanceof Error && error.message.trim()
    ? error.message
    : 'Scrum sync could not access Discord or Google Sheets.';
  return NextResponse.json({ code: 'SCRUM_SYNC_FAILED', message }, { status: 502 });
}

export async function GET(request: Request) {
  try {
    actor(request);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = dashboardQuery.safeParse(params);
    if (!parsed.success) return NextResponse.json({ message: 'Select a valid date range.' }, { status: 400 });
    const data = await getScrumDashboard(parsed.data);
    const discord = scrumDiscordConfigurationStatus();
    return NextResponse.json({ ...data, discordConfigured: discord.discordConfigured, missingProperties: [...data.missingProperties, ...discord.missingProperties] }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    writeActor(request);
    const year = z.coerce.number().int().min(2020).max(2100).safeParse((await request.json().catch(() => null) as { year?: unknown } | null)?.year);
    if (!year.success) return NextResponse.json({ message: 'Select a valid year.' }, { status: 400 });
    await setupScrumWorkbook(year.data);
    return NextResponse.json({ initialized: true, year: year.data });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = writeActor(request);
    const input = ScrumSyncSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ message: input.error.issues.map((issue) => issue.message).join('. ') }, { status: 400 });
    if (!scrumCursor(input.data)) return NextResponse.json({ message: 'Sync cursor is outside the selected range.' }, { status: 400 });
    await ensureScrumWorkbookReady(Number(input.data.fromDate.slice(0, 4)));
    return NextResponse.json(await ingestScrumPage(input.data, user.email, await fetchScrumPage(input.data)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    writeActor(request);
    const year = z.coerce.number().int().min(2020).max(2100).safeParse(new URL(request.url).searchParams.get('year'));
    if (!year.success) return NextResponse.json({ message: 'Select a valid year.' }, { status: 400 });
    const workbook = await getScrumConnectionStatus(year.data, true);
    const discord = scrumDiscordConfigurationStatus();
    const status = { connectionReady: workbook.connectionReady, sheetsReady: workbook.sheetsReady, discordConfigured: discord.discordConfigured, spreadsheetTitle: workbook.spreadsheetTitle };
    return NextResponse.json({ message: status.connectionReady && status.discordConfigured ? 'Workbook and Discord are connected.' : 'Connection setup is incomplete.', status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

