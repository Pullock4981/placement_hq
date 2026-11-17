import type { PlacementAnalyticsResponse } from './types';

const mentors = [
  ['mentor-mou', 'Mou'], ['mentor-shakil', 'Shakil'], ['mentor-rafi', 'Rafi'],
  ['mentor-sohan', 'Sohan'], ['mentor-keya', 'Keya'], ['mentor-suba', 'Suba'],
] as const;
const activeDays = [2, 3, 4, 6, 7, 9, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 30, 31];

export function placementAnalyticsMock(selectedMonth = '2026-08'): PlacementAnalyticsResponse {
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthDays = activeDays.filter((day) => day <= daysInMonth);
  const records = Array.from({ length: 56 }, (_, index) => {
    const mentor = mentors[(index * 5 + Math.floor(index / 9)) % mentors.length];
    const day = monthDays[(index * 7 + Math.floor(index / 8)) % monthDays.length];
    return {
      discordMessageId: `demo-placement-${index + 1}`,
      postedDate: `${selectedMonth}-${String(day).padStart(2, '0')}`,
      mentorId: mentor[0],
      mentorName: mentor[1],
      companyName: ['Brain Station 23', 'Enosis', 'BJIT', 'Optimizely', 'Therap', 'Cefalo'][index % 6],
      placementType: index % 5 === 0 ? 'rehired' as const : 'fresh' as const,
      batch: `Batch ${11 + (index % 4)}`,
      verificationStatus: index % 4 === 0 ? 'verified' : 'pending',
      parseStatus: index % 17 === 0 ? 'needs_review' : 'valid',
    };
  });
  const availableMonths = Array.from(new Set([selectedMonth, '2026-08', '2026-07', '2026-06'])).sort().reverse();
  return { selectedMonth, availableMonths, records, generatedAt: new Date().toISOString() };
}
