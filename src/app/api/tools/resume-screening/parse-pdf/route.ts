import { NextRequest, NextResponse } from 'next/server';
import {
  fetchDrivePdfBuffer,
  parsePdfBufferToText,
  fetchAndParseDrivePdf,
} from '@/tools/operations/resume-screening/pdf-fetcher';
import { extractGoogleDriveId } from '@/tools/operations/resume-screening/parser';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.driveUrl) {
      return NextResponse.json(
        { success: false, message: 'Google Drive URL is required.' },
        { status: 400 },
      );
    }

    const { driveUrl } = body;
    const fileId = extractGoogleDriveId(driveUrl);
    if (!fileId && !driveUrl.toLowerCase().includes('.pdf') && !driveUrl.startsWith('http')) {
      return NextResponse.json(
        { success: false, message: 'Invalid resume link format.' },
        { status: 400 },
      );
    }

    const buffer = await fetchDrivePdfBuffer(driveUrl);
    if (!buffer) {
      return NextResponse.json(
        {
          success: false,
          fileId,
          stage: 'buffer_fetch_failed',
          message:
            'Could not download PDF from Google Drive. Ensure the file has "Anyone with the link can view" access.',
        },
        { status: 422 },
      );
    }

    const { text, error: parseError } = await parsePdfBufferToText(buffer);
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          fileId,
          stage: 'text_parse_failed',
          bufferSize: buffer.length,
          parseError,
          message:
            'Could not extract PDF text directly. The file may be private ("Restricted"), corrupted, or an image-only scan.',
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      fileId,
      textLength: text.length,
      text,
    });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to parse Google Drive PDF.' },
      { status: 500 },
    );
  }
}

