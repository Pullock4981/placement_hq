import { describe, expect, it } from 'vitest';
import { WeeklyGoalCommentSchema, WeeklyGoalsCreateSchema } from '@/lib/validators/weekly-goals.schema';

describe('weekly goals validation', () => {
  it('accepts any number of valid goals without a client-selected week', () => {
    const goals = Array.from({ length: 25 }, (_, index) => `Complete measurable goal ${index + 1}`);
    expect(WeeklyGoalsCreateSchema.parse({ goals })).toEqual({ goals });
  });

  it('rejects empty goals and week overrides', () => {
    expect(WeeklyGoalsCreateSchema.safeParse({ goals: [''] }).success).toBe(false);
    expect(WeeklyGoalsCreateSchema.safeParse({ goals: ['Valid goal'], week: 12 }).success).toBe(false);
  });

  it('accepts notes but not goal edits', () => {
    const payload = { submission_id: 'dfab8b83-202b-4ba9-8f40-71fd90160127', note: 'Blocked by access approval.' };
    expect(WeeklyGoalCommentSchema.parse(payload)).toEqual(payload);
    expect(WeeklyGoalCommentSchema.safeParse({ ...payload, goals: ['Changed goal'] }).success).toBe(false);
  });
});
