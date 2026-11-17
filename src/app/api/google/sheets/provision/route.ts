import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { createAuthorizedGoogleClients } from '@/lib/google-oauth/client';
import { GoogleWorkbookProvisionError, provisionGoogleWorkbook } from '@/lib/google-oauth/provision-workbook';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { googleSheetProvisionSchema } from '@/lib/validators/google-sheet-provision.schema';
import { registerProvisionedWorkbook } from '@/lib/sheets/attachments';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({ message: 'Google Sheet creation is disabled in demo mode.' }, { status: 403 });
    }
    const manager = requireRole(request.headers, ['admin']);
    const session = openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    if (!session || session.placementUserId !== manager.id) {
      return NextResponse.json({ message: 'Connect Google before creating a workbook.' }, { status: 409 });
    }
    const grantedScopes = new Set(session.scope.split(/\s+/).filter(Boolean));
    if (!grantedScopes.has('https://www.googleapis.com/auth/spreadsheets') || !grantedScopes.has('https://www.googleapis.com/auth/drive.file')) {
      return NextResponse.json({ message: 'The current Google connection does not include Sheets and Drive file access. Disconnect Google, reconnect it, and approve both permissions.' }, { status: 409 });
    }

    const body = await request.json().catch(() => null);
    const parsed = googleSheetProvisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Invalid workbook settings.' }, { status: 400 });
    }

    const result = await provisionGoogleWorkbook(createAuthorizedGoogleClients(session), parsed.data);
    try {
      const registry = await registerProvisionedWorkbook(result, manager);
      return NextResponse.json({ data: { ...result, registry } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (registryError) {
      console.error('Google workbook was created but could not be registered in Central sheets tab', registryError);
      return NextResponse.json({ message: 'The workbook was created, but it could not be registered in the Central sheets tab. Check the Apps Script secret and Central spreadsheet access.', code: 'SHEET_REGISTRY_FAILED', data: result }, { status: 502 });
    }
  } catch (error) {
    const apiError = error as { message?: string; status?: number; code?: number };
    if (apiError.message === 'Unauthorized' || apiError.message === 'Forbidden: insufficient permissions') {
      return NextResponse.json({ message: apiError.message }, { status: apiError.message === 'Unauthorized' ? 401 : 403 });
    }
    if (error instanceof GoogleWorkbookProvisionError) {
      const reason = error.googleReason ? ` (${error.googleReason})` : '';
      if (error.googleStatus === 401) {
        return NextResponse.json({ message: 'Google authorization expired. Disconnect and reconnect the Google account.', code: 'GOOGLE_AUTH_EXPIRED' }, { status: 409 });
      }
      if (error.googleStatus === 403) {
        return NextResponse.json({ message: `Google denied workbook access${reason}. Confirm Sheets and Drive APIs are enabled for the OAuth project, then reconnect Google.`, code: 'GOOGLE_PERMISSION_DENIED', stage: error.stage }, { status: 403 });
      }
      if (error.stage === 'prepare_folder') {
        return NextResponse.json({ message: `Google could not create or access the destination folder${reason}. Reconnect Google and approve Drive file access.`, code: 'GOOGLE_FOLDER_FAILED', stage: error.stage }, { status: 502 });
      }
      if (error.stage === 'create_workbook') {
        return NextResponse.json({ message: `Google rejected workbook creation${reason}. Verify the Sheets API and OAuth permissions, then try again.`, code: 'GOOGLE_CREATE_FAILED', stage: error.stage }, { status: 502 });
      }
      if (error.stage === 'write_headers') {
        return NextResponse.json({
          message: `Google created the file but rejected the initial tab data${reason}: ${error.message}. The incomplete file was moved to trash.`,
          code: 'GOOGLE_HEADER_WRITE_FAILED',
          stage: error.stage,
        }, { status: 502 });
      }
      if (error.stage === 'place_in_folder') {
        return NextResponse.json({ message: `Google configured the workbook but could not place it in the destination folder${reason}. The workbook was moved to trash.`, code: 'GOOGLE_FOLDER_MOVE_FAILED', stage: error.stage }, { status: 502 });
      }
      return NextResponse.json({ message: `Google rejected workbook formatting${reason}. The incomplete file was moved to trash.`, code: 'GOOGLE_FORMAT_FAILED', stage: error.stage }, { status: 502 });
    }
    if (apiError.code === 401 || apiError.status === 401) {
      return NextResponse.json({ message: 'Google authorization expired. Disconnect and reconnect the Google account.' }, { status: 409 });
    }
    if (apiError.code === 403 || apiError.status === 403) {
      return NextResponse.json({ message: 'Google denied Sheet creation. Confirm Sheets and Drive APIs are enabled, then reconnect Google.' }, { status: 403 });
    }
    return NextResponse.json({ message: 'Google could not create and configure the workbook. No incomplete workbook was intentionally kept.' }, { status: 502 });
  }
}
