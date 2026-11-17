"use client";

import { useState } from "react";
import { Award, Crown, Medal, RefreshCw, Sparkles, Trophy, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PlacementMonthSelect } from "@/components/placement-analytics/placement-month-select";
import { usePlacementAnalytics } from "@/components/placement-analytics/use-placement-analytics";
import { formatPlacementMonth } from "@/lib/placement-analytics/analyze";
import type { PlacementLeaderboardEntry } from "@/lib/placement-analytics/types";
import { cn } from "@/lib/utils";
import { useDashboardMonthlyGoals } from "@/components/performance/use-dashboard-monthly-goals";
import { approvedGoalsForMember, goalProgress, includeApprovedGoalOwners, placementGoalForMember } from "@/lib/performance/dashboard-goals";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

const podiumStyles = {
  1: "border-amber-300 bg-gradient-to-b from-amber-50 via-white to-white shadow-amber-100 dark:from-amber-950/35 dark:via-card dark:to-card lg:order-2 lg:-translate-y-4",
  2: "border-slate-300 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-card lg:order-1",
  3: "border-orange-300 bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-card lg:order-3",
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function PodiumCard({ member }: { member: PlacementLeaderboardEntry }) {
  const rank = member.rank as 1 | 2 | 3;
  const Icon = rank === 1 ? Crown : rank === 2 ? Trophy : Medal;
  return (
    <article
      className={cn(
        "relative rounded-2xl border p-5 text-center shadow-lg",
        podiumStyles[rank],
      )}
    >
      <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow-sm dark:bg-card">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-md">
        {initials(member.mentorName)}
      </div>
      <p className="mt-3 truncate font-black" title={member.mentorName}>
        {member.mentorName}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        Rank #{member.rank}
      </p>
      <p className="mt-4 text-4xl font-black tracking-tight tabular-nums">
        {member.placements}
      </p>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        Placements
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
        <div>
          <p className="font-black">{member.activeDays}</p>
          <p className="text-muted-foreground">Active days</p>
        </div>
        <div>
          <p className="font-black">{member.contribution}%</p>
          <p className="text-muted-foreground">Team share</p>
        </div>
      </div>
    </article>
  );
}

function PulseBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-300/90 dark:bg-slate-700", className)} />;
}

function MonthlyPerformanceSkeleton() {
  const heights = [28, 42, 35, 58, 44, 68, 52, 78, 46, 62, 84, 56, 72, 48, 66, 88, 54, 74, 60, 82, 45, 70, 50, 76, 64, 90, 58, 80, 52, 72, 62];
  return (
    <div className="grid gap-6 p-5 xl:grid-cols-[15rem_1fr]" aria-label="Loading monthly placement performance">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {heights.slice(0, 3).map((height) => <PulseBlock key={height} className="h-28 rounded-2xl" />)}
      </div>
      <div className="min-w-0">
        <PulseBlock className="mb-3 h-9" />
        <div className="flex h-60 min-w-[48rem] items-end gap-2 border-b border-dashed px-2 pb-7 pt-3">
          {heights.map((height, index) => <div key={index} className="flex h-full min-w-4 flex-1 items-end justify-center"><div className="w-2 animate-pulse rounded-full bg-slate-300/90 dark:bg-slate-700" style={{ height: `${height}%` }} /></div>)}
        </div>
      </div>
    </div>
  );
}

export function ManagerPlacementDashboard() {
  const { user } = useAuth();
  const analytics = usePlacementAnalytics();
  const goalsQuery = useDashboardMonthlyGoals(analytics.month);
  const goals = goalsQuery.data ?? [];
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const { analysis, data } = analytics;
  const teamRanking = includeApprovedGoalOwners(analysis.leaderboard, goals);
  const maximum = Math.max(1, ...analysis.days.map((day) => day.total));
  const highlightedDay =
    analysis.days.find((day) => day.date === hoveredDate) || analysis.peakDay;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 pb-10">
      <DashboardPageHeader eyebrow="Programming Hero · Job Placement Team" title={`${greeting()}, ${user?.name || "Manager"}.`} description={`${dateLabel} · Here is your team’s placement performance.`} />

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Monthly performance
            </p>
            <h2 className="mt-1 text-xl font-black">
              {formatPlacementMonth(analysis.selectedMonth)} placements
            </h2>
          </div>
          <PlacementMonthSelect
            value={analytics.month}
            months={data.availableMonths}
            onChange={analytics.setMonth}
            disabled={analytics.isFetching}
          />
        </div>
        {analytics.isPending ? <MonthlyPerformanceSkeleton /> : analytics.error && !data.records.length ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-black">Placement data is currently unavailable.</p>
            <button type="button" className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground" onClick={() => void analytics.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Try again</button>
          </div>
        ) : <div className="grid gap-6 p-5 xl:grid-cols-[15rem_1fr]">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl bg-violet-600 p-4 text-white"><p className="text-xs font-bold text-violet-100">Total placements</p><p className="mt-2 text-4xl font-black tabular-nums">{analysis.totalPlacements}</p><p className="mt-2 text-[11px] text-violet-100">{analysis.activeDays} active days</p></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Fresh placements</p><p className="mt-2 text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">{analysis.totalFreshPlacements}</p><p className="mt-2 text-[11px] text-emerald-700/75 dark:text-emerald-300/75">First-time placements</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-xs font-bold text-amber-700 dark:text-amber-300">Rehired placements</p><p className="mt-2 text-4xl font-black tabular-nums text-amber-700 dark:text-amber-300">{analysis.totalRehiredPlacements}</p><p className="mt-2 text-[11px] text-amber-700/75 dark:text-amber-300/75">Returning candidates</p></div>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex min-h-9 items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2 text-xs">
              <span className="font-bold text-muted-foreground">
                Daily placement activity
              </span>
              <span className="font-black text-primary">
                {highlightedDay
                  ? `${highlightedDay.date} · ${highlightedDay.total} placed`
                  : "Hover a line for details"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="flex h-60 min-w-[48rem] items-end gap-2 border-b border-dashed px-2 pb-7 pt-3">
                {analysis.days.map((day) => (
                  <div
                    key={day.date}
                    className="group relative flex h-full min-w-4 flex-1 items-end justify-center"
                    title={`${day.date}: ${day.total} placed`}
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <div
                      className={cn(
                        "w-2 rounded-full transition-all duration-300 group-hover:w-2.5 group-hover:bg-amber-400",
                        day.total
                          ? "bg-gradient-to-t from-violet-700 to-fuchsia-500"
                          : "h-px bg-muted",
                      )}
                      style={
                        day.total
                          ? {
                              height: `${Math.max(8, (day.total / maximum) * 100)}%`,
                            }
                          : undefined
                      }
                    />
                    <span className="absolute -bottom-5 text-[9px] font-semibold text-muted-foreground">
                      {day.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Team placement records
            </p>
            <h2 className="mt-1 text-2xl font-black">Top performers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current ranking for {formatPlacementMonth(analysis.selectedMonth)}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold">
              <Users className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
              {analysis.contributors} contributors
            </span>
            <span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"><Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-emerald-600" />{analysis.totalFreshPlacements} fresh</span>
            <span className="rounded-xl border bg-card px-3 py-2 text-xs font-bold"><RefreshCw className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />{analysis.totalRehiredPlacements} rehired</span>
          </div>
        </div>
        {analytics.isPending ? (
          <div className="grid gap-4 pt-4 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <PulseBlock key={item} className="h-64 rounded-2xl" />)}
          </div>
        ) : analysis.leaderboard.length ? (
          <div className="grid gap-4 pt-4 lg:grid-cols-3 lg:items-end">
            {analysis.leaderboard.slice(0, 3).map((member) => (
              <PodiumCard key={member.mentorId} member={member} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed py-14 text-center">
            <Award className="mx-auto h-9 w-9 text-muted-foreground/40" />
            <p className="mt-3 font-black">
              No placements in this reporting month
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-black">Full team ranking</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by placements, then active placement days.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {[
                  "Rank",
                  "Team member",
                  "Total placements",
                  "Fresh",
                  "Rehired",
                  "Monthly goals",
                  "Goal achieved",
                  "Active days",
                  "Best day",
                ].map((heading) => (
                  <th key={heading} className="px-5 py-3 font-black">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.isPending ? [1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className="border-t">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cell) => <td key={cell} className="px-5 py-4"><PulseBlock className="h-8" /></td>)}
                </tr>
              )) : teamRanking.map((member) => (
                <tr
                  key={member.mentorId}
                  className="border-t transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black",
                        member.rank <= 3
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-muted",
                      )}
                    >
                      #{member.rank}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                        {initials(member.mentorName)}
                      </span>
                      <div>
                        <p className="font-black">{member.mentorName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {member.companies} companies
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-lg font-black tabular-nums">
                    {member.placements}
                  </td>
                  <td className="px-5 py-4 font-bold text-emerald-600 tabular-nums">{member.freshPlacements}</td>
                  <td className="px-5 py-4 font-bold text-amber-600 tabular-nums">{member.rehiredPlacements}</td>
                  <td className="px-5 py-4">{goalsQuery.isPending ? <PulseBlock className="h-10 w-24" /> : (() => { const memberGoals = approvedGoalsForMember(goals, member); return memberGoals.length ? <div className="space-y-1.5">{memberGoals.map((goal) => <div key={`${goal.title}-${goal.target_value}`} className="rounded-lg bg-violet-50 px-2.5 py-1.5 dark:bg-violet-950/30"><p className="text-[10px] font-bold text-muted-foreground">{goal.title}</p><p className="font-black tabular-nums text-violet-700 dark:text-violet-300">{goal.target_value}</p></div>)}</div> : <span className="text-muted-foreground">Not set</span>; })()}</td>
                  <td className="px-5 py-4">{goalsQuery.isPending ? <PulseBlock className="h-10 w-24" /> : (() => { const goal = placementGoalForMember(goals, member); const progress = goalProgress(member, goal); return progress === null ? <span className="text-muted-foreground">—</span> : <div className="min-w-28"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-black text-violet-700 dark:text-violet-300">{progress}%</span><span className="font-bold tabular-nums text-muted-foreground">{member.placements}/{goal?.target_value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${Math.min(100, progress)}%` }} /></div></div>; })()}</td>
                  <td className="px-5 py-4 font-bold tabular-nums">
                    {member.activeDays}
                  </td>
                  <td className="px-5 py-4 font-bold tabular-nums">
                    {member.bestDay}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!analytics.isPending && !teamRanking.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No team ranking is available for this month.
          </p>
        )}
      </section>
    </div>
  );
}
