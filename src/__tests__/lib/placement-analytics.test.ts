import { describe, expect, it } from 'vitest';
import { analyzePlacementMonth, formatPlacementMonth } from '@/lib/placement-analytics/analyze';
import type { PlacementAnalyticsResponse } from '@/lib/placement-analytics/types';

const response: PlacementAnalyticsResponse = {
  selectedMonth: '2026-08', availableMonths: ['2026-08'], generatedAt: '2026-09-01T00:00:00.000Z',
  records: [
    { discordMessageId: '1', postedDate: '2026-08-01', mentorId: 'a', mentorName: 'Mou', companyName: 'Acme', batch: '13', verificationStatus: 'verified', parseStatus: 'valid' },
    { discordMessageId: '2', postedDate: '2026-08-01', mentorId: 'a', mentorName: 'Mou', companyName: 'BJIT', batch: '14', verificationStatus: 'pending', parseStatus: 'needs_review', placementType: 'rehired' },
    { discordMessageId: '3', postedDate: '2026-08-02', mentorId: 'a', mentorName: 'Mou', companyName: 'Acme', batch: '13', verificationStatus: 'pending', parseStatus: 'valid' },
    { discordMessageId: '4', postedDate: '2026-08-02', mentorId: 'b', mentorName: 'Rafi', companyName: 'Acme', batch: '13', verificationStatus: 'verified', parseStatus: 'valid' },
    { discordMessageId: '4', postedDate: '2026-08-02', mentorId: 'b', mentorName: 'Rafi', companyName: 'Acme', batch: '13', verificationStatus: 'verified', parseStatus: 'valid' },
    { discordMessageId: 'other', postedDate: '2026-07-31', mentorId: 'x', mentorName: 'Other', companyName: 'Other', batch: '1', verificationStatus: 'verified', parseStatus: 'valid' },
  ],
};

describe('placement month analysis', () => {
  it('builds calendar totals and per-member daily counts without duplicates', () => {
    const analysis = analyzePlacementMonth(response);
    expect(analysis).toMatchObject({ selectedMonth: '2026-08', daysInMonth: 31, startWeekday: 6, totalPlacements: 4, totalFreshPlacements: 3, totalRehiredPlacements: 1, activeDays: 2, contributors: 2, averagePerActiveDay: 2 });
    expect(analysis.days[0]).toMatchObject({ date: '2026-08-01', total: 2, mentors: [{ id: 'a', name: 'Mou', count: 2 }] });
    expect(analysis.days[1]).toMatchObject({ total: 2, mentors: [{ id: 'a', count: 1 }, { id: 'b', count: 1 }] });
    expect(analysis.peakDay?.date).toBe('2026-08-01');
  });

  it('ranks by placements and exposes transparent quality and consistency metrics', () => {
    const [mou, rafi] = analyzePlacementMonth(response).leaderboard;
    expect(mou).toMatchObject({ rank: 1, mentorName: 'Mou', placements: 3, freshPlacements: 2, rehiredPlacements: 1, contribution: 75, activeDays: 2, bestDay: 2, currentStreak: 2, verified: 1, needsReview: 1, companies: 2, batches: 2 });
    expect(rafi).toMatchObject({ rank: 2, placements: 1, freshPlacements: 1, rehiredPlacements: 0, contribution: 25, activeDays: 1, verified: 1 });
  });

  it('summarizes companies, batches and empty months safely', () => {
    expect(analyzePlacementMonth(response).companies[0]).toEqual({ name: 'Acme', count: 3, share: 75 });
    const empty = analyzePlacementMonth({ ...response, selectedMonth: '2026-06', records: [] });
    expect(empty).toMatchObject({ totalPlacements: 0, totalFreshPlacements: 0, totalRehiredPlacements: 0, activeDays: 0, contributors: 0, peakDay: null, averagePerActiveDay: 0, leaderboard: [] });
    expect(formatPlacementMonth('2026-08')).toBe('August 2026');
  });
});
