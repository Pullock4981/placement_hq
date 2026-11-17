import { describe, expect, it } from 'vitest';
import { MENTOR_STUDENT_STATUSES } from '@/constants';
import { MentorStudentSheetAttachmentSchema, MentorStudentStatusUpdateSchema } from '@/lib/validators/mentor-student-sheet.schema';

const validAttachment = {
  sheet_url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit',
  worksheet_name: 'Mentees',
  batch: 'Batch 13',
  level: 'Level-1',
  duration_months: 3,
  confirmed_public_view: true,
};

describe('mentor mentee sheet validation', () => {
  it('accepts the complete viewer-only import contract', () => {
    expect(MentorStudentSheetAttachmentSchema.parse(validAttachment)).toEqual(validAttachment);
  });

  it('limits mentorship duration to one through six months', () => {
    expect(MentorStudentSheetAttachmentSchema.safeParse({ ...validAttachment, duration_months: 0 }).success).toBe(false);
    expect(MentorStudentSheetAttachmentSchema.safeParse({ ...validAttachment, duration_months: 7 }).success).toBe(false);
  });

  it('requires public viewer confirmation', () => {
    expect(MentorStudentSheetAttachmentSchema.safeParse({ ...validAttachment, confirmed_public_view: false }).success).toBe(false);
  });

  it.each(MENTOR_STUDENT_STATUSES)('accepts mentor status %s', (current_status) => {
    expect(MentorStudentStatusUpdateSchema.safeParse({ row_number: 2, current_status, status_note: '' }).success).toBe(true);
  });

  it('rejects statuses outside the mentor status list', () => {
    expect(MentorStudentStatusUpdateSchema.safeParse({ row_number: 2, current_status: 'Learning', status_note: '' }).success).toBe(false);
  });
});
