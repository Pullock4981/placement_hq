'use client';

import { useState } from 'react';
import { Award, Building2, Crown, Medal, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePlacementAnalytics } from '@/components/placement-analytics/use-placement-analytics';
import { useDashboardMonthlyGoals } from '@/components/performance/use-dashboard-monthly-goals';
import { PlacementMonthSelect } from '@/components/placement-analytics/placement-month-select';
import { formatPlacementMonth } from '@/lib/placement-analytics/analyze';
import type { PlacementLeaderboardEntry } from '@/lib/placement-analytics/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { approvedGoalsForMember, goalProgress, includeApprovedGoalOwners, placementGoalForMember, type DashboardMonthlyGoal } from '@/lib/performance/dashboard-goals';
import { MentorGoalFeedback } from '@/components/performance/mentor-goal-feedback';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

const podiumStyles = {
  1: 'border-amber-300 bg-gradient-to-b from-amber-50 via-white to-white shadow-amber-100 dark:from-amber-950/35 dark:via-card dark:to-card lg:order-2 lg:-translate-y-4',
  2: 'border-slate-300 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-card lg:order-1',
  3: 'border-orange-300 bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-card lg:order-3',
} as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function PodiumCard({ member }: { member: PlacementLeaderboardEntry }) {
  const rank = member.rank as 1 | 2 | 3;
  const Icon = rank === 1 ? Crown : rank === 2 ? Trophy : Medal;
  return (
    <article className={cn('relative rounded-2xl border p-5 text-center shadow-lg', podiumStyles[rank])}>
      <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow-sm dark:bg-card"><Icon className="h-4 w-4" /></span>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-md">{initials(member.mentorName)}</div>
      <p className="mt-3 truncate font-black" title={member.mentorName}>{member.mentorName}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">Rank #{member.rank}</p>
      <p className="mt-4 text-4xl font-black tracking-tight tabular-nums">{member.placements}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Placements</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs"><div><p className="font-black">{member.activeDays}</p><p className="text-muted-foreground">Active days</p></div><div><p className="font-black">{member.contribution}%</p><p className="text-muted-foreground">Team share</p></div></div>
    </article>
  );
}

function MentorPositionRow({ member, goals }: { member: PlacementLeaderboardEntry; goals: DashboardMonthlyGoal[] }) {
  const memberGoals = approvedGoalsForMember(goals, member);
  const placementGoal = placementGoalForMember(goals, member);
  const progress = goalProgress(member, placementGoal);
  return <article className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-sm dark:border-violet-900 dark:from-violet-950/30 dark:to-fuchsia-950/20">
    <div className="grid gap-4 p-4 sm:grid-cols-[80px_minmax(0,1.4fr)_minmax(160px,1fr)_120px_140px] sm:items-center">
      <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Your rank</p><p className="mt-1 text-2xl font-black text-violet-700 dark:text-violet-300">#{member.rank}</p></div>
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-xs font-black text-white">{initials(member.mentorName)}</span><div><p className="font-black">{member.mentorName}</p><Badge className="mt-1 bg-violet-600 text-white">Your position</Badge></div></div>
      <div>{memberGoals.length ? <div className="space-y-1">{memberGoals.map((goal) => <p key={`${goal.title}-${goal.target_value}`} className="text-xs"><span className="font-semibold text-muted-foreground">{goal.title}:</span> <span className="font-black">{goal.target_value}</span></p>)}</div> : <span className="text-xs text-muted-foreground">Goals not set</span>}</div>
      <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Placements</p><p className="mt-1 text-xl font-black">{member.placements}</p></div>
      <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Goal achieved</p><p className="mt-1 text-xl font-black text-emerald-600">{progress === null ? '—' : `${progress}%`}</p></div>
    </div>
  </article>;
}

function TeamRanking({ members, currentMentorId, goals }: { members: PlacementLeaderboardEntry[]; currentMentorId?: string; goals: DashboardMonthlyGoal[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b p-5"><h2 className="text-lg font-black">Full team ranking</h2><p className="mt-1 text-xs text-muted-foreground">Fresh and rehired placements by team member.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[64rem] text-left text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{['Rank', 'Team member', 'Monthly goals', 'Placement record', 'Goal achieved', 'Fresh', 'Rehired', 'Active days'].map((heading) => <th key={heading} className="px-5 py-3 font-black">{heading}</th>)}</tr></thead><tbody>{members.map((member) => { const isCurrentMentor = member.mentorId === currentMentorId; const memberGoals = approvedGoalsForMember(goals, member); const placementGoal = placementGoalForMember(goals, member); const progress = goalProgress(member, placementGoal); return <tr key={member.mentorId} className={cn('border-t transition-colors hover:bg-muted/30', isCurrentMentor && 'bg-violet-50 ring-1 ring-inset ring-violet-300 hover:bg-violet-100/70 dark:bg-violet-950/30 dark:ring-violet-700')}><td className="px-5 py-4"><span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black', member.rank <= 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-muted')}>#{member.rank}</span></td><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{initials(member.mentorName)}</span><div><div className="flex items-center gap-2"><p className="font-black">{member.mentorName}</p>{isCurrentMentor && <Badge className="bg-violet-600 text-white">You</Badge>}</div><p className="text-[11px] text-muted-foreground">{member.companies} companies</p></div></div></td><td className="px-5 py-4">{memberGoals.length ? <div className="space-y-1.5">{memberGoals.map((goal) => <div key={`${goal.title}-${goal.target_value}`}><p className="text-[10px] font-semibold text-muted-foreground">{goal.title}</p><p className="font-black tabular-nums text-violet-700 dark:text-violet-300">{goal.target_value}</p></div>)}</div> : <span className="text-muted-foreground">Not set</span>}</td><td className="px-5 py-4"><p className="text-lg font-black tabular-nums">{member.placements}</p><p className="text-[10px] text-muted-foreground">Current placements</p></td><td className="px-5 py-4">{progress === null ? <span className="text-muted-foreground">—</span> : <div className="min-w-24"><div className="flex justify-between text-xs font-black"><span>{progress}%</span><span className="text-muted-foreground">{member.placements}/{placementGoal?.target_value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500" style={{ width: `${Math.min(100, progress)}%` }} /></div></div>}</td><td className="px-5 py-4 font-bold text-emerald-600 tabular-nums">{member.freshPlacements}</td><td className="px-5 py-4 font-bold text-amber-600 tabular-nums">{member.rehiredPlacements}</td><td className="px-5 py-4 font-bold tabular-nums">{member.activeDays}</td></tr>; })}</tbody></table></div>
      {!members.length && <p className="p-10 text-center text-sm text-muted-foreground">No team ranking is available for this month.</p>}
    </section>
  );
}

export function MentorPlacementDashboard() {
  const { user } = useAuth();
  const analytics = usePlacementAnalytics();
  const goalsQuery = useDashboardMonthlyGoals(analytics.month);
  const goals = goalsQuery.data ?? [];
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  if (analytics.isPending) return <div className="space-y-5"><div className="h-40 animate-pulse rounded-3xl bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  const { analysis, data } = analytics;
  const teamRanking = includeApprovedGoalOwners(analysis.leaderboard, goals);
  const normalizedEmail = user?.email.trim().toLowerCase();
  const normalizedName = user?.name.trim().toLowerCase();
  const monthRecords = data.records.filter((record) => record.postedDate.startsWith(analysis.selectedMonth));
  const records = monthRecords.filter((record) =>
    (user?.discord_user_id && record.mentorId === user.discord_user_id)
    || (normalizedEmail && record.mentorEmail?.trim().toLowerCase() === normalizedEmail)
    || (normalizedName && record.mentorName.trim().toLowerCase() === normalizedName),
  ).sort((first, second) => second.postedDate.localeCompare(first.postedDate));
  const currentMentorId = records[0]?.mentorId || user?.discord_user_id;
  const currentMember = teamRanking.find((member) => member.mentorId === currentMentorId || approvedGoalsForMember(goals, member).some((goal) => goal.user_id === user?.id));
  const dailyCounts = records.reduce<Record<string, number>>((counts, record) => ({ ...counts, [record.postedDate]: (counts[record.postedDate] || 0) + 1 }), {});
  const personalDays = analysis.days.map((day) => ({ ...day, total: dailyCounts[day.date] || 0 }));
  const maximum = Math.max(1, ...personalDays.map((day) => day.total));
  const personalPeakDay = personalDays.reduce<(typeof personalDays)[number] | null>((peak, day) => day.total > 0 && (!peak || day.total > peak.total) ? day : peak, null);
  const highlightedDay = personalDays.find((day) => day.date === hoveredDate) || personalPeakDay;
  const totalFresh = records.filter((record) => record.placementType !== 'rehired').length;
  const totalRehired = records.filter((record) => record.placementType === 'rehired').length;
  const personalActiveDays = new Set(records.map((record) => record.postedDate)).size;

  return (
    <div className="mx-auto max-w-[96rem] space-y-7 pb-10">
      <DashboardPageHeader eyebrow="Programming Hero · Placement Team" title={`${greeting()}, ${user?.name || 'Mentor'}.`} description={`Team placement performance for ${formatPlacementMonth(analysis.selectedMonth)}.`} />

      <MentorGoalFeedback />

      {analytics.error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Placement analytics could not refresh.</p><p className="mt-0.5 text-xs opacity-80">Showing the last available data. Your goals and other dashboard sections remain available.</p></div><button type="button" className="inline-flex h-9 items-center justify-center rounded-xl bg-amber-900 px-4 text-xs font-black text-white disabled:opacity-50 dark:bg-amber-300 dark:text-amber-950" disabled={analytics.isFetching} onClick={() => void analytics.refetch()}><RefreshCw className={cn('mr-2 h-3.5 w-3.5', analytics.isFetching && 'animate-spin')} />{analytics.isFetching ? 'Reloading' : 'Reload analytics'}</button></div>}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Placement leaderboard</p><h2 className="mt-1 text-2xl font-black">Top 3 performers</h2><p className="mt-1 text-sm text-muted-foreground">Leading contributors this month.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"><Users className="mr-1.5 inline h-3.5 w-3.5 text-primary" />{analysis.contributors} contributors</span><span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"><Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-emerald-600" />{analysis.totalFreshPlacements} fresh</span><span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"><RefreshCw className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />{analysis.totalRehiredPlacements} rehired</span></div></div>
        {analysis.leaderboard.length ? <><div className="grid gap-4 pt-4 lg:grid-cols-3 lg:items-end">{analysis.leaderboard.slice(0, 3).map((member) => <PodiumCard key={member.mentorId} member={member} />)}</div>{currentMember && currentMember.rank > 3 && <MentorPositionRow member={currentMember} goals={goals} />}</> : <div className="rounded-2xl border border-dashed py-14 text-center"><Award className="mx-auto h-9 w-9 text-muted-foreground/40" /><p className="mt-3 font-black">No placements this month</p></div>}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Monthly performance</p><h2 className="mt-1 text-xl font-black">{formatPlacementMonth(analysis.selectedMonth)} placement activity</h2></div><PlacementMonthSelect value={analytics.month} months={data.availableMonths} onChange={analytics.setMonth} disabled={analytics.isFetching} /></div>
        <div className="grid gap-6 p-5 xl:grid-cols-[15rem_1fr]">
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-1"><div className="rounded-2xl bg-violet-600 p-4 text-white"><p className="text-xs font-bold text-violet-100">My total placements</p><p className="mt-2 text-4xl font-black tabular-nums">{records.length}</p><p className="mt-2 text-[11px] text-violet-100">{personalActiveDays} active days · Rank #{currentMember?.rank ?? '—'}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">My fresh placements</p><p className="mt-2 text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">{totalFresh}</p><p className="mt-2 text-[11px] text-emerald-700/75 dark:text-emerald-300/75">First-time placements</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-xs font-bold text-amber-700 dark:text-amber-300">My rehired placements</p><p className="mt-2 text-4xl font-black tabular-nums text-amber-700 dark:text-amber-300">{totalRehired}</p><p className="mt-2 text-[11px] text-amber-700/75 dark:text-amber-300/75">Returning candidates</p></div></div>
          <div className="min-w-0"><div className="mb-3 flex min-h-9 items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2 text-xs"><span className="font-bold text-muted-foreground">My daily placement activity</span><span className="font-black text-primary">{highlightedDay ? `${highlightedDay.date} · ${highlightedDay.total} placed` : 'Hover a line for details'}</span></div><div className="overflow-x-auto"><div className="flex h-60 min-w-[48rem] items-end gap-2 border-b border-dashed px-2 pb-7 pt-3">{personalDays.map((day) => <div key={day.date} className="group relative flex h-full min-w-4 flex-1 items-end justify-center" title={`${day.date}: ${day.total} placed`} onMouseEnter={() => setHoveredDate(day.date)} onMouseLeave={() => setHoveredDate(null)}><div className={cn('w-2 rounded-full transition-all duration-300 group-hover:w-2.5 group-hover:bg-amber-400', day.total ? 'bg-gradient-to-t from-violet-700 to-fuchsia-500' : 'h-px bg-muted')} style={day.total ? { height: `${Math.max(8, (day.total / maximum) * 100)}%` } : undefined} /><span className="absolute -bottom-5 text-[9px] font-semibold text-muted-foreground">{day.day}</span></div>)}</div></div></div>
        </div>
      </section>

      <TeamRanking members={teamRanking} currentMentorId={currentMember?.mentorId || currentMentorId} goals={goals} />

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">My placement records</p><h2 className="mt-1 text-xl font-black">My placements this month</h2></div><Badge variant="secondary" className="w-fit rounded-full px-3 py-1">{records.length} placements</Badge></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{['Date', 'Candidate', 'Company', 'Batch', 'Status'].map((heading) => <th key={heading} className="px-5 py-3 font-black">{heading}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.discordMessageId} className="border-t transition-colors hover:bg-muted/30"><td className="whitespace-nowrap px-5 py-4 font-bold">{record.placementDate || record.postedDate}</td><td className="px-5 py-4"><p className="font-bold">{record.candidateName || 'Candidate not specified'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{record.position || 'Position not specified'}</p></td><td className="px-5 py-4"><span className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-violet-500" />{record.companyName || 'Not specified'}</span></td><td className="px-5 py-4 text-muted-foreground">{record.batch || '—'}</td><td className="px-5 py-4"><Badge variant={record.verificationStatus.toLowerCase() === 'verified' ? 'default' : 'outline'}>{record.verificationStatus || 'Pending'}</Badge></td></tr>)}</tbody></table></div>
        {!records.length && <p className="p-10 text-center text-sm text-muted-foreground">No placement records are available for this month.</p>}
      </section>
    </div>
  );
}
