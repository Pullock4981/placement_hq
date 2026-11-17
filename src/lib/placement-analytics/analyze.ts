import type {
  PlacementAnalyticsRecord,
  PlacementAnalyticsResponse,
  PlacementDay,
  PlacementLeaderboardEntry,
  PlacementMonthAnalysis,
} from './types';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function formatPlacementMonth(month: string) {
  if (!monthPattern.test(month)) return month;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

function mentorIdentity(record: PlacementAnalyticsRecord) {
  const name = record.mentorName.trim() || 'Unassigned mentor';
  return { id: record.mentorId.trim() || `name:${name.toLowerCase()}`, name };
}

function longestConsecutiveRun(days: number[]) {
  let longest = 0;
  let current = 0;
  let previous = -2;
  Array.from(new Set(days)).sort((first, second) => first - second).forEach((day) => {
    current = day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
}

function countNames(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const name = value.trim() || 'Not specified';
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

export function analyzePlacementMonth(response: PlacementAnalyticsResponse): PlacementMonthAnalysis {
  const selectedMonth = monthPattern.test(response.selectedMonth) ? response.selectedMonth : '1970-01';
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const unique = new Map<string, PlacementAnalyticsRecord>();
  response.records.forEach((record) => {
    if (record.postedDate.startsWith(selectedMonth) && /^\d{4}-\d{2}-\d{2}$/.test(record.postedDate)) {
      unique.set(record.discordMessageId, record);
    }
  });
  const records = Array.from(unique.values());
  const dayMentors = new Map<number, Map<string, { name: string; count: number }>>();
  records.forEach((record) => {
    const day = Number(record.postedDate.slice(8, 10));
    if (day < 1 || day > daysInMonth) return;
    const identity = mentorIdentity(record);
    const mentors = dayMentors.get(day) || new Map();
    const current = mentors.get(identity.id);
    mentors.set(identity.id, { name: identity.name, count: (current?.count || 0) + 1 });
    dayMentors.set(day, mentors);
  });
  const days: PlacementDay[] = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const mentors = Array.from((dayMentors.get(day) || new Map<string, { name: string; count: number }>()).entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
    return { date: `${selectedMonth}-${String(day).padStart(2, '0')}`, day, total: mentors.reduce((sum, mentor) => sum + mentor.count, 0), mentors };
  });

  const members = new Map<string, { name: string; records: PlacementAnalyticsRecord[] }>();
  records.forEach((record) => {
    const identity = mentorIdentity(record);
    const member = members.get(identity.id) || { name: identity.name, records: [] };
    member.records.push(record);
    members.set(identity.id, member);
  });
  const sortedMembers = Array.from(members.entries()).sort((first, second) =>
    second[1].records.length - first[1].records.length || first[1].name.localeCompare(second[1].name));
  const leaderboard: PlacementLeaderboardEntry[] = sortedMembers.map(([mentorId, member], index) => {
    const activeDayNumbers = member.records.map((record) => Number(record.postedDate.slice(8, 10)));
    const dailyCounts = activeDayNumbers.reduce<Record<number, number>>((counts, day) => ({ ...counts, [day]: (counts[day] || 0) + 1 }), {});
    return {
      rank: index + 1,
      mentorId,
      mentorName: member.name,
      mentorEmail: member.records.find((record) => record.mentorEmail?.trim())?.mentorEmail?.trim(),
      placements: member.records.length,
      contribution: records.length ? Math.round((member.records.length / records.length) * 1000) / 10 : 0,
      activeDays: new Set(activeDayNumbers).size,
      bestDay: Math.max(0, ...Object.values(dailyCounts)),
      currentStreak: longestConsecutiveRun(activeDayNumbers),
      verified: member.records.filter((record) => record.verificationStatus.toLowerCase() === 'verified').length,
      freshPlacements: member.records.filter((record) => record.placementType !== 'rehired').length,
      rehiredPlacements: member.records.filter((record) => record.placementType === 'rehired').length,
      needsReview: member.records.filter((record) => record.parseStatus !== 'valid').length,
      companies: new Set(member.records.map((record) => record.companyName.trim()).filter(Boolean)).size,
      batches: new Set(member.records.map((record) => record.batch.trim()).filter(Boolean)).size,
    };
  });
  const activeDays = days.filter((day) => day.total > 0);
  const companies = countNames(records.map((record) => record.companyName)).map((company) => ({
    ...company,
    share: records.length ? Math.round((company.count / records.length) * 100) : 0,
  }));
  return {
    selectedMonth,
    daysInMonth,
    startWeekday,
    days,
    totalPlacements: records.length,
    totalFreshPlacements: records.filter((record) => record.placementType !== 'rehired').length,
    totalRehiredPlacements: records.filter((record) => record.placementType === 'rehired').length,
    activeDays: activeDays.length,
    contributors: members.size,
    peakDay: activeDays.reduce<PlacementDay | null>((peak, day) => !peak || day.total > peak.total ? day : peak, null),
    averagePerActiveDay: activeDays.length ? Math.round((records.length / activeDays.length) * 10) / 10 : 0,
    leaderboard,
    companies,
    batches: countNames(records.map((record) => record.batch)),
  };
}
