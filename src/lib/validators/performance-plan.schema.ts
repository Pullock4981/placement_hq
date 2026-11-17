import { z } from 'zod';
import { PERFORMANCE_PLAN_TYPE, PERFORMANCE_UNITS, QUARTERS } from '@/constants';

const numericValue = z.string().trim().regex(/^\d+(?:\.\d+)?$/, 'Enter a valid non-negative number');

export const MonthlyKpiSchema = z.object({
  type: z.literal(PERFORMANCE_PLAN_TYPE.MONTHLY_KPI),
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Select a valid month'),
  mentor_id: z.string().trim(),
  mentor_email: z.string().trim().toLowerCase(),
  mentor_name: z.string().trim(),
  agenda: z.string().trim().min(2, 'Agenda is required').max(160),
  target_value: z.string().trim().regex(/^\d+$/, 'Enter a whole-number placement goal').refine((value) => Number(value) > 0, 'Placement goal must be greater than zero'),
  notes: z.string().trim().max(500),
});

export const MentorMonthlyGoalsSchema = z.object({
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Select a valid month'),
  goals: z.array(z.object({
    agenda: z.string().trim().min(2, 'Agenda is required').max(160),
    target_value: z.string().trim().regex(/^\d+$/, 'Enter a whole-number goal').refine((value) => Number(value) > 0, 'Goal must be greater than zero'),
  })).min(1, 'Add at least one goal').max(10, 'Use no more than ten goals'),
});

export const KeyResultSchema = z.object({
  title: z.string().trim().min(3, 'Describe the measurable result').max(160),
  target_value: numericValue,
  unit: z.enum(PERFORMANCE_UNITS),
});

export const QuarterlyOkrSchema = z.object({
  type: z.literal(PERFORMANCE_PLAN_TYPE.QUARTERLY_OKR),
  year: z.string().regex(/^20\d{2}$/, 'Select a valid year'),
  quarter: z.enum(QUARTERS),
  objective: z.string().trim().min(5, 'Objective must be at least 5 characters').max(180),
  key_results: z.array(KeyResultSchema).min(1, 'Add at least one key result').max(5, 'Use no more than five key results'),
  notes: z.string().trim().max(500),
});

export const PerformancePlanCreateSchema = z.discriminatedUnion('type', [MonthlyKpiSchema, QuarterlyOkrSchema]);

export type MonthlyKpiInput = z.infer<typeof MonthlyKpiSchema>;
export type MentorMonthlyGoalsInput = z.infer<typeof MentorMonthlyGoalsSchema>;
export type QuarterlyOkrInput = z.infer<typeof QuarterlyOkrSchema>;
export type PerformancePlanCreateInput = z.infer<typeof PerformancePlanCreateSchema>;

export const MonthlyKpiUpdateSchema = z.object({
  id: z.string().trim().min(1),
  agenda: z.string().trim().min(2, 'Agenda is required').max(160),
  target_value: z.string().trim().regex(/^\d+$/, 'Enter a whole-number goal').refine((value) => Number(value) > 0, 'Goal must be greater than zero'),
  notes: z.string().trim().max(500),
});

export const PerformancePlanCommentSchema = z.object({
  id: z.string().trim().min(1),
  review_action: z.literal('comment'),
  manager_note: z.string().trim().min(2, 'Add a comment for the mentor').max(500, 'Manager comment is too long'),
});

export const PerformancePlanApprovalSchema = z.object({
  id: z.string().trim().min(1),
  approval_status: z.enum(['approved', 'rejected']),
});
