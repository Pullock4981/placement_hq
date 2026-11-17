import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { placementAnalyticsMock } from '@/lib/placement-analytics/mock-data';
import { getPlacementAnalytics, PlacementSheetsError } from '@/lib/placement-sync/sheets';
import { PlacementAnalyticsResponseSchema, PlacementMonthSchema } from '@/lib/validators/placement-analytics.schema';

export const dynamic = 'force-dynamic';

function requirePlacementViewer(request: Request) {
  return requireRole(request.headers, ['manager', 'mentor']);
}

export async function GET(request: Request) {
  try {
    const requestedMonth = new URL(request.url).searchParams.get('month');
    if (requestedMonth && !PlacementMonthSchema.safeParse(requestedMonth).success) {
      return NextResponse.json({ code: 'INVALID_MONTH', message: 'Choose a valid calendar month.' }, { status: 400 });
    }
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (!demo) requirePlacementViewer(request);
    const result = demo ? placementAnalyticsMock(requestedMonth || undefined) : await getPlacementAnalytics(requestedMonth || undefined);
    const parsed = PlacementAnalyticsResponseSchema.safeParse(result);
    if (!parsed.success) throw new PlacementSheetsError('Placement workbook data does not match the supported schema.', 'CONFLICT');
    return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } });
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
    if (status === 401) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in to view placement analytics.' }, { status: 401 });
    if (status === 403) return NextResponse.json({ code: 'FORBIDDEN', message: 'You do not have placement analytics access.' }, { status: 403 });
    if (error instanceof PlacementSheetsError) {
      const responseStatus = error.code === 'NOT_READY' ? 409 : error.code === 'NOT_CONFIGURED' ? 503 : 502;
      return NextResponse.json({ code: error.code, message: error.message }, { status: responseStatus });
    }
    const apiError = error as { code?: number };
    if (apiError.code === 403) return NextResponse.json({ code: 'GOOGLE_ACCESS_DENIED', message: 'The Apps Script deploying account cannot read the Placement workbook.' }, { status: 503 });
    console.error('[Placement analytics] Google Sheets operation failed:', error);
    return NextResponse.json({ code: 'UPSTREAM_ERROR', message: 'Placement analytics are temporarily unavailable. No workbook data was changed.' }, { status: 502 });
  }
}
