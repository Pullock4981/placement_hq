import { z } from 'zod';
import { EXPERIENCE_LEVELS, JOB_FOCUSES, PROJECT_NAMES, RISK_LEVELS, RISK_STATUSES, STUDENT_STAGES } from '@/constants';

const OPTIONAL_PROJECT_NAMES = [...PROJECT_NAMES, ''] as const;
const OPTIONAL_JOB_FOCUSES = [...JOB_FOCUSES, ''] as const;
const OPTIONAL_EXPERIENCE_LEVELS = [...EXPERIENCE_LEVELS, ''] as const;
const OPTIONAL_RISK_LEVELS = [...RISK_LEVELS, ''] as const;

export const CreateStudentSchema = z.object({
  name: z.string().min(2).max(100),
  batch: z.string().min(1).max(50),
  mentor_email: z.string().email(),
  student_email: z.string().email().optional().or(z.literal('')),
  project: z.enum(OPTIONAL_PROJECT_NAMES).optional(),
  job_focus: z.enum(JOB_FOCUSES).optional(),
  experience: z.enum(EXPERIENCE_LEVELS).optional(),
  phone: z.string().max(40).optional(),
  photo_url: z.string().url().optional().or(z.literal('')),
  join_date: z.string().optional(),
  hired_company_name: z.string().max(200).optional(),
  hired_date: z.string().optional(),
  terminated_reason: z.string().max(500).optional(),
  terminated_date: z.string().optional(),
  assignment_completion_pct: z.number().min(0).max(100).optional(),
  follow_up_date: z.string().optional(),
  interview_count: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  batch: z.string().min(1).max(50).optional(),
  mentor_email: z.string().email().optional(),
  student_email: z.string().email().optional().or(z.literal('')),
  project: z.enum(OPTIONAL_PROJECT_NAMES).optional(),
  stage: z.enum(STUDENT_STAGES).optional(),
  risk_status: z.enum(RISK_STATUSES).optional(),
  risk_reasons: z.string().optional(),
  last_activity_date: z.string().optional(),
  job_focus: z.enum(OPTIONAL_JOB_FOCUSES).optional(),
  terminated: z.boolean().optional(),
  hired: z.boolean().optional(),
  experience: z.enum(OPTIONAL_EXPERIENCE_LEVELS).optional(),
  phone: z.string().max(40).optional(),
  photo_url: z.string().url().optional().or(z.literal('')),
  join_date: z.string().optional(),
  hired_company_name: z.string().max(200).optional(),
  hired_date: z.string().optional(),
  terminated_reason: z.string().max(500).optional(),
  terminated_date: z.string().optional(),
  assignment_completion_pct: z.number().min(0).max(100).optional(),
  follow_up_date: z.string().optional(),
  interview_count: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  risk_override_level: z.enum(OPTIONAL_RISK_LEVELS).optional(),
  risk_override_note: z.string().max(1000).optional(),
  risk_override_expires_at: z.string().optional(),
}).strict();

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

export const AttendanceSchema = z.object({
  student_id: z.string().uuid(),
  date: z.string(),
  present: z.boolean(),
  logged_by: z.string(),
});

export type AttendanceInput = z.infer<typeof AttendanceSchema>;

export const ProgressLogSchema = z.object({
  student_id: z.string().uuid(),
  note: z.string().min(1).max(1000),
  logged_by: z.string(),
});

export type ProgressLogInput = z.infer<typeof ProgressLogSchema>;
