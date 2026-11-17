import { describe, expect, it } from 'vitest';
import { PERFORMANCE_PLAN_TYPE } from '@/constants';
import { MonthlyKpiSchema, PerformancePlanCommentSchema, QuarterlyOkrSchema } from '@/lib/validators/performance-plan.schema';

describe('performance plan validation', () => {
  it('accepts a mentor monthly placement goal', () => {
    const result = MonthlyKpiSchema.safeParse({
      type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI,
      month: '2026-09',
      mentor_id: 'mentor-1',
      mentor_email: 'mentor@example.com',
      mentor_name: 'Example Mentor',
      agenda: 'Monthly placement',
      target_value: '15',
      notes: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid months and zero placement goals', () => {
    const result = MonthlyKpiSchema.safeParse({
      type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI,
      month: '2026-13',
      mentor_id: 'mentor-1',
      mentor_email: 'mentor@example.com',
      mentor_name: 'Example Mentor',
      agenda: 'Monthly placement',
      target_value: '0',
      notes: '',
    });

    expect(result.success).toBe(false);
  });

  it('requires a meaningful manager comment when requesting changes', () => {
    expect(PerformancePlanCommentSchema.safeParse({ id: 'goal-1', review_action: 'comment', manager_note: 'Increase the placement target.' }).success).toBe(true);
    expect(PerformancePlanCommentSchema.safeParse({ id: 'goal-1', review_action: 'comment', manager_note: '' }).success).toBe(false);
  });

  it('requires one to five measurable quarterly key results', () => {
    const valid = QuarterlyOkrSchema.safeParse({
      type: PERFORMANCE_PLAN_TYPE.QUARTERLY_OKR,
      year: '2026',
      quarter: 'Q3',
      objective: 'Improve placement operations quality',
      key_results: [{ title: 'Verify placement records within two days', target_value: '2', unit: 'days' }],
      notes: '',
    });
    const invalid = QuarterlyOkrSchema.safeParse({
      type: PERFORMANCE_PLAN_TYPE.QUARTERLY_OKR,
      year: '2026',
      quarter: 'Q3',
      objective: 'Improve placement operations quality',
      key_results: [],
      notes: '',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
