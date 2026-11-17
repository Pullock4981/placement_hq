import type { PlacementLeaderboardEntry } from '@/lib/placement-analytics/types';

export interface DashboardMonthlyGoal {
  user_id: string;
  user_email: string;
  user_name: string;
  mentor_name: string;
  title: string;
  target_value: number;
  metric: string;
  unit: string;
  approval_status: string;
  discord_user_id: string;
  discord_username: string;
}

function normalized(value?: string) {
  return (value || '').trim().replace(/^@/, '').toLowerCase();
}

function normalizedName(value?: string) {
  return normalized(value).replace(/[^a-z0-9]/g, '');
}

function discordId(value?: string) {
  return normalized(value).replace(/[^0-9]/g, '');
}

export function approvedGoalsForMember(goals: DashboardMonthlyGoal[], member: PlacementLeaderboardEntry) {
  const memberDiscordId = discordId(member.mentorId);
  const memberName = normalizedName(member.mentorName);
  const memberEmail = normalized(member.mentorEmail);
  return goals.filter((goal) => {
    if (normalized(goal.approval_status) !== 'approved') return false;
    const goalDiscordId = discordId(goal.discord_user_id);
    const names = [goal.discord_username, goal.mentor_name, goal.user_name].map(normalizedName).filter(Boolean);
    return Boolean(
      (memberDiscordId && goalDiscordId && memberDiscordId === goalDiscordId)
      || (memberEmail && normalized(goal.user_email) === memberEmail)
      || (memberName && names.some((name) => name === memberName || (name.length >= 5 && (name.includes(memberName) || memberName.includes(name)))))
      || normalized(goal.user_id) === normalized(member.mentorId),
    );
  });
}

export function placementGoalForMember(goals: DashboardMonthlyGoal[], member: PlacementLeaderboardEntry) {
  const memberGoals = approvedGoalsForMember(goals, member);
  return memberGoals.find((goal) => normalized(goal.title).includes('placement')) || memberGoals[0];
}

export function goalProgress(member: PlacementLeaderboardEntry, goal?: DashboardMonthlyGoal) {
  if (!goal?.target_value) return null;
  return Math.round((member.placements / goal.target_value) * 100);
}

export function includeApprovedGoalOwners(members: PlacementLeaderboardEntry[], goals: DashboardMonthlyGoal[]) {
  const output = [...members];
  const approvedOwners = new Map<string, DashboardMonthlyGoal>();
  goals.filter((goal) => normalized(goal.approval_status) === 'approved').forEach((goal) => {
    const key = normalized(goal.user_id) || normalized(goal.user_email) || discordId(goal.discord_user_id);
    if (key && !approvedOwners.has(key)) approvedOwners.set(key, goal);
  });
  approvedOwners.forEach((goal) => {
    if (output.some((member) => approvedGoalsForMember([goal], member).length > 0)) return;
    output.push({
      rank: 0,
      mentorId: goal.discord_user_id || goal.user_id || `goal:${normalized(goal.user_email)}`,
      mentorName: goal.mentor_name || goal.discord_username || goal.user_name || goal.user_email,
      mentorEmail: goal.user_email,
      placements: 0,
      contribution: 0,
      activeDays: 0,
      bestDay: 0,
      currentStreak: 0,
      verified: 0,
      freshPlacements: 0,
      rehiredPlacements: 0,
      needsReview: 0,
      companies: 0,
      batches: 0,
    });
  });
  return output.map((member, index) => ({ ...member, rank: index + 1 }));
}
