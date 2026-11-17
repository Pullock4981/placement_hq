import { z } from 'zod';

const dayMilliseconds = 86_400_000;
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}, 'Enter a real calendar date');

export const ScrumSyncSchema = z.object({
  fromDate: calendarDate,
  toDate: calendarDate,
  cursor: z.string().regex(/^\d{1,20}$/).optional(),
  runId: z.string().uuid(),
}).superRefine((value, context) => {
  const days = (Date.parse(`${value.toDate}T00:00:00Z`) - Date.parse(`${value.fromDate}T00:00:00Z`)) / dayMilliseconds;
  if (days < 0) context.addIssue({ code: 'custom', path: ['toDate'], message: 'End date must be on or after the start date' });
  if (days > 92) context.addIssue({ code: 'custom', path: ['toDate'], message: 'Choose at most 93 days' });
  if (value.fromDate.slice(0, 4) !== value.toDate.slice(0, 4)) context.addIssue({ code: 'custom', path: ['toDate'], message: 'Scrum sync must stay within one calendar year' });
});

export type ScrumSyncInput = z.infer<typeof ScrumSyncSchema>;

