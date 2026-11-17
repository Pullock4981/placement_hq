/**
 * Resume & Document Parser Utilities
 */

/**
 * Extracts Google Drive file ID from various Drive URL formats.
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Format 1: /file/d/<id>
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Format 2: ?id=<id> or &id=<id>
  const idQueryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1]) return idQueryMatch[1];

  // Format 3: /document/d/<id>
  const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) return docMatch[1];

  // Format 4: Bare Google Drive File ID (typically 25-50 alphanumeric characters)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Checks if the input is a Google Drive URL.
 */
export function isGoogleDriveUrl(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim().toLowerCase();
  return (
    (trimmed.includes('drive.google.com') ||
      trimmed.includes('docs.google.com') ||
      trimmed.includes('drive.usercontent.google.com') ||
      /^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) &&
    extractGoogleDriveId(input) !== null
  );
}

/**
 * Cleans and tokenizes text for keyword matching.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\w\s.+/#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts raw text lines from resume input.
 */
export function extractLines(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

