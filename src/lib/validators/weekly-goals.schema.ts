import { z } from 'zod';

export const WeeklyGoalsCreateSchema = z.object({
  goals: z.array(z.string().trim().min(3, 'Each goal must be at least 3 characters.').max(300, 'Each goal must be 300 characters or fewer.')).min(1, 'Add at least one weekly goal.'),
}).strict();

export const WeeklyGoalCommentSchema = z.object({
  submission_id: z.string().uuid('Invalid weekly goal submission.'),
  note: z.string().trim().min(2, 'Add a note before saving.').max(1000, 'Notes must be 1,000 characters or fewer.'),
}).strict();
