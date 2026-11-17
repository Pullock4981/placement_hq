import { z } from 'zod';
import { SHEET_DOMAIN, SHEET_DOMAINS } from '@/constants';

export const SheetDomainSchema = z.enum(SHEET_DOMAINS);

export const SheetAttachmentSchema = z.object({
  domain: SheetDomainSchema,
  batch: z.string().trim().min(1, 'Enter a batch code or GLOBAL').max(50, 'Batch code is too long').transform((value) => value.toUpperCase()),
  sheet_url: z.string().trim().min(1, 'Paste a Google Sheet URL or spreadsheet ID'),
  worksheet_name: z.string().trim().max(100, 'Worksheet name is too long'),
  access_mode: z.enum(['read_only', 'read_write']),
  protect_headers: z.boolean(),
}).superRefine((value, context) => {
  if (value.protect_headers && value.access_mode !== 'read_write') {
    context.addIssue({ code: 'custom', path: ['protect_headers'], message: 'Header protection requires read and write access' });
  }
  if ((value.domain === SHEET_DOMAIN.PLACEMENTS || value.domain === SHEET_DOMAIN.SCRUM_UPDATES) && !/^20\d{2}$/.test(value.batch)) {
    context.addIssue({ code: 'custom', path: ['batch'], message: 'Annual workbook scope must be a four-digit year, such as 2026' });
  }
});

export type SheetAttachmentInput = z.infer<typeof SheetAttachmentSchema>;
export type SheetDomain = z.infer<typeof SheetDomainSchema>;
