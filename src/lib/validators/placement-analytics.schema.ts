import { z } from 'zod';
import type { PlacementAnalyticsResponse } from '@/lib/placement-analytics/types';

export const PlacementMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

export const PlacementAnalyticsResponseSchema: z.ZodType<PlacementAnalyticsResponse> = z.object({
  selectedMonth: PlacementMonthSchema,
  availableMonths: z.array(PlacementMonthSchema),
  records: z.array(z.object({
    discordMessageId: z.string().min(1).max(100),
    postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mentorId: z.string().max(100),
    mentorName: z.string().max(200),
    mentorEmail: z.string().max(320).optional(),
    candidateName: z.string().max(200).optional(),
    companyName: z.string().max(300),
    position: z.string().max(200).optional(),
    placementDate: z.string().max(50).optional(),
    placementType: z.enum(['fresh', 'rehired']).optional(),
    batch: z.string().max(100),
    verificationStatus: z.string().max(100),
    parseStatus: z.string().max(100),
  })).max(5000),
  generatedAt: z.string().datetime(),
});
