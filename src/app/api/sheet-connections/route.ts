import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { attachGoogleSheet, getServiceAccountEmail, listSheetConnections } from '@/lib/sheets/attachments';
import { SheetAttachmentSchema } from '@/lib/validators/sheet-attachment.schema';

function getAdmin(request: Request) {
  return requireRole(request.headers, ['admin']);
}

function isConfigured() {
  return Boolean(
    (process.env.GOOGLE_SHEET_MANAGEMENT_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID)
    && (
      (process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET)
      || process.env.GOOGLE_SHEETS_REFRESH_TOKEN
      || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      || process.env.GOOGLE_APPLICATION_CREDENTIALS
    )
  );
}

function errorResponse(error: unknown) {
  const apiError = error as { message?: string; status?: number; code?: number };
  if (apiError.status === 401 || apiError.status === 403) {
    return NextResponse.json({ message: apiError.message }, { status: apiError.status });
  }
  if (apiError.code === 403) {
    return NextResponse.json({ message: 'The configured Google identity cannot access this spreadsheet. Check that account’s sharing permissions first.' }, { status: 403 });
  }
  if (apiError.code === 404) {
    return NextResponse.json({ message: 'Spreadsheet not found. Check the URL and sharing settings.' }, { status: 404 });
  }
  const message = error instanceof Error ? error.message : 'Unable to process the spreadsheet';
  const safeMessage = message.includes('environment variable') ? 'Google Sheets is not configured on the server.' : message;
  return NextResponse.json({ message: safeMessage }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({ configured: false, service_account_email: null, data: [] });
    }
    getAdmin(request);
    const configured = isConfigured();
    if (!configured) return NextResponse.json({ configured: false, service_account_email: getServiceAccountEmail() ?? null, data: [] });
    return NextResponse.json({ configured: true, service_account_email: getServiceAccountEmail(), data: await listSheetConnections() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({ message: 'Real Google Sheet connections are disabled in hosted demo mode.' }, { status: 403 });
    }
    const manager = getAdmin(request);
    if (!isConfigured()) return NextResponse.json({ message: 'Google Sheets is not configured on the server.' }, { status: 503 });
    const result = SheetAttachmentSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ message: 'Validation failed', errors: result.error.flatten().fieldErrors }, { status: 400 });
    const connection = await attachGoogleSheet(result.data, manager);
    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
