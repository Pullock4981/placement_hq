import { z } from 'zod';
import { MENTOR_STUDENT_STATUSES } from '@/constants';

export const MentorStudentSheetAttachmentSchema = z.object({
  sheet_url: z.string().trim().min(1, 'Paste a Google Sheet link'),
  worksheet_name: z.string().trim().min(1, 'Enter the worksheet name').max(100, 'Worksheet name is too long'),
  batch: z.string().trim().min(1, 'Enter the batch name').max(50, 'Batch name is too long'),
  level: z.enum(['Level-1', 'Level-2']),
  duration_months: z.coerce.number().int().min(1, 'Duration must be at least 1 month').max(6, 'Duration cannot exceed 6 months'),
  confirmed_public_view: z.boolean().refine((value) => value, 'Confirm that anyone with the link can view this sheet'),
});

export const MentorStudentStatusUpdateSchema = z.object({
  row_number: z.number().int().min(2),
  current_status: z.enum(MENTOR_STUDENT_STATUSES),
  status_note: z.string().trim().max(500, 'Status note is too long'),
});

export type MentorStudentSheetAttachmentInput = z.infer<typeof MentorStudentSheetAttachmentSchema>;
export type MentorStudentStatusUpdateInput = z.infer<typeof MentorStudentStatusUpdateSchema>;
