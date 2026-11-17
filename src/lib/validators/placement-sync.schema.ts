import { z } from 'zod';
import type { PlacementSyncPage, PlacementSyncStatus } from '@/lib/placement-sync/types';

const dayMilliseconds = 24 * 60 * 60 * 1000;

const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}, 'Enter a real calendar date').refine((value) => value >= '2015-01-01', 'Dates must be on or after 2015-01-01');

const DiscordCursorSchema = z.string().regex(/^\d{1,20}$/, 'Cursor must be a Discord snowflake');

export const PlacementSyncSchema = z.object({
  fromDate: CalendarDateSchema,
  toDate: CalendarDateSchema,
  cursor: DiscordCursorSchema.optional(),
  runId: z.string().uuid('Run ID must be a UUID'),
}).superRefine((value, context) => {
  const daysApart = (Date.parse(`${value.toDate}T00:00:00.000Z`) - Date.parse(`${value.fromDate}T00:00:00.000Z`)) / dayMilliseconds;
  if (daysApart < 0) {
    context.addIssue({ code: 'custom', path: ['toDate'], message: 'End date must be on or after the start date' });
  }
  if (daysApart + 1 > 93) {
    context.addIssue({ code: 'custom', path: ['toDate'], message: 'Choose at most 93 days, including both dates' });
  }
  if (value.fromDate.slice(0, 4) !== value.toDate.slice(0, 4)) {
    context.addIssue({ code: 'custom', path: ['toDate'], message: 'A placement sync must stay within one calendar year because each year uses a separate workbook' });
  }
});

export type PlacementSyncInput = z.infer<typeof PlacementSyncSchema>;

export const PlacementSyncStatusSchema: z.ZodType<PlacementSyncStatus> = z.object({
  ingestionVersion: z.literal(1).optional(),
  connectionReady: z.boolean(),
  sheetsReady: z.boolean(),
  discordConfigured: z.boolean(),
  syncSupported: z.boolean().nullable().optional(),
  missingProperties: z.array(z.string()),
  spreadsheetTitle: z.string().nullable(),
  spreadsheetUrl: z.string().nullable(),
  masterRows: z.number().int().nonnegative(),
  months: z.array(z.string()),
  recentRecords: z.array(z.object({
    discord_message_id: z.string(),
    candidate_name: z.string(),
    candidate_email: z.string(),
    company_name: z.string(),
    position: z.string(),
    job_type: z.string(),
    batch: z.string(),
    course: z.string(),
    project_name: z.string(),
    mentor_name: z.string(),
    mentor_email: z.string(),
    verification_status: z.string(),
    parse_status: z.string(),
    posted_at: z.string(),
    discord_message_url: z.string(),
  })),
  lastSync: z.record(z.string(), z.unknown()).nullable(),
});

export const PlacementSyncPageSchema: z.ZodType<PlacementSyncPage> = z.object({
  runId: z.string().uuid(),
  fetched: z.number().int().min(0).max(100),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
  nextCursor: DiscordCursorSchema.nullable(),
  complete: z.boolean(),
}).refine((value) => value.complete === (value.nextCursor === null), 'Incomplete pages must supply a cursor');
