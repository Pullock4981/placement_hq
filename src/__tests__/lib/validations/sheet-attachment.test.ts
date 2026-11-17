import { describe, expect, it } from 'vitest';
import { extractSpreadsheetId } from '@/lib/sheets/attachments';
import { SheetAttachmentSchema } from '@/lib/validators/sheet-attachment.schema';

const spreadsheetId = '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890';

describe('Google Sheet attachment validation', () => {
  it('extracts an ID from a Google Sheets URL', () => {
    expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`)).toBe(spreadsheetId);
  });

  it('accepts a raw spreadsheet ID', () => {
    expect(extractSpreadsheetId(spreadsheetId)).toBe(spreadsheetId);
  });

  it('rejects non-Google spreadsheet URLs', () => {
    expect(() => extractSpreadsheetId(`https://example.com/spreadsheets/d/${spreadsheetId}`)).toThrow('Only https://docs.google.com');
  });

  it('requires write access before enabling header protection', () => {
    const result = SheetAttachmentSchema.safeParse({ domain: 'student_information', batch: 'web-12', sheet_url: spreadsheetId, worksheet_name: '', access_mode: 'read_only', protect_headers: true });
    expect(result.success).toBe(false);
  });

  it('normalizes batch keys for registry lookups', () => {
    const result = SheetAttachmentSchema.parse({ domain: 'student_information', batch: 'web-12', sheet_url: spreadsheetId, worksheet_name: '', access_mode: 'read_only', protect_headers: false });
    expect(result.batch).toBe('WEB-12');
  });

  it('requires a four-digit year when assigning a placement workbook', () => {
    const valid = SheetAttachmentSchema.safeParse({ domain: 'placement_information', batch: '2026', sheet_url: spreadsheetId, worksheet_name: '01_2026', access_mode: 'read_write', protect_headers: true });
    const invalid = SheetAttachmentSchema.safeParse({ domain: 'placement_information', batch: 'GLOBAL', sheet_url: spreadsheetId, worksheet_name: '01_2026', access_mode: 'read_write', protect_headers: true });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
