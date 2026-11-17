/**
 * Google Drive PDF Fetcher & Parser
 * Downloads public Google Drive PDF files and parses text using pdf-parse
 */

import { extractGoogleDriveId } from './parser';

/**
 * Downloads a public Google Drive file or direct PDF URL and returns the Buffer if it's a valid PDF.
 */
export async function fetchDrivePdfBuffer(driveUrl: string): Promise<Buffer | null> {
  const fileId = extractGoogleDriveId(driveUrl);

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/pdf,*/*',
  };

  // If no Google file ID, but it's an HTTP URL that might be a direct PDF
  if (!fileId) {
    if (driveUrl.toLowerCase().includes('.pdf') || driveUrl.startsWith('http')) {
      try {
        const directRes = await fetch(driveUrl, { headers, redirect: 'follow', cache: 'no-store' });
        if (directRes.ok) {
          const arr = await directRes.arrayBuffer();
          const buf = Buffer.from(arr);
          if (buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-') {
            return buf;
          }
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  const downloadEndpoints = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://docs.google.com/uc?export=download&id=${fileId}`,
    `https://docs.google.com/document/d/${fileId}/export?format=pdf`,
  ];

  for (const endpoint of downloadEndpoints) {
    try {
      const response = await fetch(endpoint, {
        headers,
        redirect: 'follow',
        cache: 'no-store',
      });

      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify if buffer starts with %PDF- header
      if (buffer.length > 4 && buffer.slice(0, 5).toString('ascii') === '%PDF-') {
        return buffer;
      }

      // If response is HTML, check for Google Drive's "Download Anyway" virus scan page
      const textPreview = buffer.slice(0, 2048).toString('utf-8');
      if (textPreview.includes('uc-download-link') || textPreview.includes('confirm=')) {
        const confirmMatch = textPreview.match(/confirm=([a-zA-Z0-9_-]+)/);
        if (confirmMatch && confirmMatch[1]) {
          const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
          const confirmRes = await fetch(confirmUrl, { headers, redirect: 'follow' });
          if (confirmRes.ok) {
            const confArr = await confirmRes.arrayBuffer();
            const confBuf = Buffer.from(confArr);
            if (confBuf.slice(0, 5).toString('ascii') === '%PDF-') {
              return confBuf;
            }
          }
        }
      }
    } catch {
      // Continue to next endpoint on failure
    }
  }

  return null;
}

/**
 * Extracts plain text from a PDF Buffer using pdf-parse.
 */
export async function parsePdfBufferToText(
  buffer: Buffer,
): Promise<{ text: string; error?: string }> {
  if (!buffer || buffer.length === 0) return { text: '' };
  try {
    // Dynamic import to prevent SSR bundling issues
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return { text: result.text || '' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
    console.error('PDF parsing error inside parsePdfBufferToText:', errorMsg);
    return { text: '', error: errorMsg };
  }
}

/**
 * Downloads and parses text from a public Google Drive PDF, Google Doc, or direct PDF link.
 */
export async function fetchAndParseDrivePdf(driveUrl: string): Promise<string | null> {
  if (!driveUrl || typeof driveUrl !== 'string') return null;
  const cleanUrl = driveUrl.trim();

  // 1. If it's a Google Doc, try direct txt export first (fastest and cleanest text)
  const fileId = extractGoogleDriveId(cleanUrl);
  if (fileId && cleanUrl.includes('docs.google.com/document')) {
    try {
      const docRes = await fetch(`https://docs.google.com/document/d/${fileId}/export?format=txt`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        cache: 'no-store',
      });
      if (docRes.ok) {
        const docText = await docRes.text();
        if (docText && docText.trim().length > 30 && !docText.includes('<!DOCTYPE html>')) {
          return docText.trim();
        }
      }
    } catch {
      // Continue to PDF buffer
    }
  }

  // 2. Fetch PDF buffer and parse text
  try {
    const buffer = await fetchDrivePdfBuffer(cleanUrl);
    if (!buffer) return null;
    const { text } = await parsePdfBufferToText(buffer);
    return text && text.trim().length > 20 ? text.trim() : null;
  } catch (err) {
    console.error('[DEBUG fetchAndParseDrivePdf] caught outer error:', err);
    return null;
  }
}

