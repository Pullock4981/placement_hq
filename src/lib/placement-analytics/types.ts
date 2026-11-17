export interface PlacementAnalyticsRecord {
  discordMessageId: string;
  postedDate: string;
  mentorId: string;
  mentorName: string;
  mentorEmail?: string;
  candidateName?: string;
  companyName: string;
  position?: string;
  placementDate?: string;
  placementType?: 'fresh' | 'rehired';
  batch: string;
  verificationStatus: string;
  parseStatus: string;
}

export interface PlacementAnalyticsResponse {
  selectedMonth: string;
  availableMonths: string[];
  records: PlacementAnalyticsRecord[];
  generatedAt: string;
}

export interface DailyMentorCount {
  id: string;
  name: string;
  count: number;
}

export interface PlacementDay {
  date: string;
  day: number;
  total: number;
  mentors: DailyMentorCount[];
}

export interface PlacementLeaderboardEntry {
  rank: number;
  mentorId: string;
  mentorName: string;
  mentorEmail?: string;
  placements: number;
  contribution: number;
  activeDays: number;
  bestDay: number;
  currentStreak: number;
  verified: number;
  freshPlacements: number;
  rehiredPlacements: number;
  needsReview: number;
  companies: number;
  batches: number;
}

export interface PlacementMonthAnalysis {
  selectedMonth: string;
  daysInMonth: number;
  startWeekday: number;
  days: PlacementDay[];
  totalPlacements: number;
  totalFreshPlacements: number;
  totalRehiredPlacements: number;
  activeDays: number;
  contributors: number;
  peakDay: PlacementDay | null;
  averagePerActiveDay: number;
  leaderboard: PlacementLeaderboardEntry[];
  companies: Array<{ name: string; count: number; share: number }>;
  batches: Array<{ name: string; count: number }>;
}
