import { NextRequest, NextResponse } from 'next/server';
import {
  extractGoogleSheetId,
  extractGoogleSheetGid,
  getColumnLetter,
} from '@/tools/operations/resume-screening/sheet-processor';
import { getCachedNexViewData } from '@/tools/operations/nexview/nexview-store';
import {
  formatInterviewTo15Columns,
  NEXVIEW_15_HEADERS,
} from '@/tools/operations/nexview/nexview-engine';
import { getSheetsClient } from '@/lib/sheets/client';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { createAuthorizedGoogleClients } from '@/lib/google-oauth/client';
import type { sheets_v4 } from 'googleapis';

export const runtime = 'nodejs';

function formatSafeRange(sheetTitle: string, a1Range: string): string {
  const cleanTitle = (sheetTitle || 'Sheet1').trim();
  const escapedTitle = cleanTitle.replace(/'/g, "''");
  return `'${escapedTitle}'!${a1Range}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.sheetUrl) {
      return NextResponse.json(
        { success: false, message: 'Please provide a Google Sheet URL.' },
        { status: 400 },
      );
    }

    const { sheetUrl } = body;
    const spreadsheetId = extractGoogleSheetId(sheetUrl);

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Invalid Google Sheet URL. Spreadsheet ID not found.' },
        { status: 400 },
      );
    }

    const { interviews } = getCachedNexViewData();
    if (interviews.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No interview records found.' },
        { status: 400 },
      );
    }

    const oauthCookie = request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value;
    const userOAuthSession = openGoogleOAuthSession(oauthCookie);
    let client: sheets_v4.Sheets;

    if (userOAuthSession?.refreshToken) {
      try {
        client = createAuthorizedGoogleClients(userOAuthSession).sheets;
      } catch {
        client = await getSheetsClient();
      }
    } else {
      client = await getSheetsClient();
    }

    let sheets: any[] = [];
    try {
      const sheetMeta = (await client.spreadsheets.get({ spreadsheetId } as any)) as any;
      sheets = sheetMeta.data?.sheets || [];
    } catch (metaErr) {
      console.warn('Could not read sheet metadata:', metaErr);
    }

    const targetGid = extractGoogleSheetGid(sheetUrl);
    let targetSheet = sheets[0];
    if (targetGid !== null && sheets.length > 0) {
      const matched = sheets.find((s: any) => s?.properties?.sheetId === targetGid);
      if (matched) targetSheet = matched;
    }

    const firstSheetName = targetSheet?.properties?.title || 'Sheet1';
    const buildRange = (a1: string) => formatSafeRange(firstSheetName, a1);

    const endColLetter = getColumnLetter(NEXVIEW_15_HEADERS.length - 1);

    // 1. Write Row 1 Headers
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: buildRange(`A1:${endColLetter}1`),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [NEXVIEW_15_HEADERS] },
    } as any);

    // 2. Prepare Rows for all interviews
    const rowsMatrix = interviews.map((item) => {
      const r = formatInterviewTo15Columns(item);
      return [
        r.studentName,
        r.email,
        r.phone,
        r.course,
        r.slotOrBatch,
        r.status,
        r.interpersonalSkills,
        r.languageProficiency,
        r.cameraAndEnvironment,
        r.technicalSolved,
        r.technicalPartiallySolved,
        r.technicalCantSolve,
        r.problemSolving,
        r.finalRecommendation,
        r.generalFeedback,
      ];
    });

    const maxRow = rowsMatrix.length + 1;
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: buildRange(`A2:${endColLetter}${maxRow}`),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rowsMatrix },
    } as any);

    return NextResponse.json({
      success: true,
      message: `Successfully synced complete assessments for ${interviews.length} candidate(s) in 15 columns to Google Sheet!`,
      totalSynced: interviews.length,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      {
        success: false,
        message: e.message || 'Failed to write data to Google Sheet. Ensure sheet has edit permissions.',
      },
      { status: 500 },
    );
  }
}
