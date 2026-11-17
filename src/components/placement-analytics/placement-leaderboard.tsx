'use client';

import { useMemo, useState } from 'react';
import { Award, BadgeCheck, Building2, CalendarCheck, Search, Sparkles, Trophy, Users } from 'lucide-react';
import { PlacementPageHeader } from './placement-page-header';
import { PlacementMonthSelect } from './placement-month-select';
import { PlacementKpi } from './placement-kpi';
import { usePlacementAnalytics } from './use-placement-analytics';
import { formatPlacementMonth } from '@/lib/placement-analytics/analyze';
import type { PlacementLeaderboardEntry } from '@/lib/placement-analytics/types';
import { cn } from '@/lib/utils';

const podiumStyles = {
  1: 'order-1 border-amber-300 bg-gradient-to-b from-amber-50 to-white pt-5 shadow-amber-200/60 md:order-2 md:-translate-y-4 dark:from-amber-950/35 dark:to-card',
  2: 'order-2 border-slate-300 bg-gradient-to-b from-slate-50 to-white md:order-1 dark:from-slate-900 dark:to-card',
  3: 'order-3 border-orange-300 bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-card',
} as const;
const medals = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function PodiumCard({ member }: { member: PlacementLeaderboardEntry }) {
  const rank = member.rank as 1 | 2 | 3;
  return <article className={cn('relative flex-1 rounded-2xl border p-5 text-center shadow-md', podiumStyles[rank])}>
    <span className="absolute right-3 top-3 text-2xl" aria-label={`Rank ${rank}`}>{medals[rank]}</span>
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black text-white shadow-lg">{initials(member.mentorName)}</div>
    <p className="mt-3 truncate font-black" title={member.mentorName}>{member.mentorName}</p><p className="mt-1 text-xs text-muted-foreground">#{member.rank} contributor</p>
    <p className="mt-4 text-4xl font-black tracking-tight tabular-nums">{member.placements}</p><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">placements</p>
    <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs"><div><p className="font-black">{member.activeDays}</p><p className="text-muted-foreground">Active days</p></div><div><p className="font-black">{member.contribution}%</p><p className="text-muted-foreground">Team share</p></div></div>
  </article>;
}

export function PlacementLeaderboard() {
  const analytics = usePlacementAnalytics();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => analytics.analysis?.leaderboard.filter((member) => member.mentorName.toLowerCase().includes(search.toLowerCase().trim())) || [], [analytics.analysis?.leaderboard, search]);
  if (analytics.isPending) return <div className="space-y-5" aria-label="Loading placement leaderboard"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="grid h-72 grid-cols-3 gap-4"><div className="animate-pulse rounded-2xl bg-muted" /><div className="animate-pulse rounded-2xl bg-muted" /><div className="animate-pulse rounded-2xl bg-muted" /></div></div>;
  if (analytics.error || !analytics.analysis || !analytics.data) return <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{analytics.error instanceof Error ? analytics.error.message : 'Placement leaderboard data is unavailable.'}</div>;
  const { analysis, data } = analytics;
  const leader = analysis.leaderboard[0];
  const verified = analysis.leaderboard.reduce((sum, member) => sum + member.verified, 0);
  return <div className="mx-auto max-w-[92rem] space-y-5 pb-10">
    <PlacementPageHeader eyebrow="Team recognition" title="Placement leaderboard" description="Recognize the members creating placement outcomes, compare consistency, and identify records that still need operational review." />
    <section className="flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center"><div><h2 className="font-black">{formatPlacementMonth(analysis.selectedMonth)} rankings</h2><p className="mt-1 text-xs text-muted-foreground">Ranked by unique placements, then active placement days and member name.</p></div><PlacementMonthSelect value={analytics.month} months={data.availableMonths} onChange={analytics.setMonth} disabled={analytics.isFetching} /></section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PlacementKpi label="Team placements" value={analysis.totalPlacements} helper={`${analysis.contributors} contributing team members`} icon={Trophy} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
      <PlacementKpi label="Current leader" value={leader?.mentorName || '—'} helper={leader ? `${leader.placements} placements · ${leader.contribution}% share` : 'No rankings for this month'} icon={Award} tone="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" />
      <PlacementKpi label="Verified records" value={verified} helper={`${analysis.totalPlacements ? Math.round((verified / analysis.totalPlacements) * 100) : 0}% of synchronized placements`} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
      <PlacementKpi label="Peak activity" value={analysis.peakDay?.total || 0} helper={analysis.peakDay ? `${analysis.peakDay.date} was the strongest day` : 'No active placement day'} icon={CalendarCheck} tone="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" />
    </section>

    {analysis.leaderboard.length > 0 ? <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="podium-title"><div className="text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Top performers</p><h2 id="podium-title" className="mt-1 text-xl font-black">Placement podium</h2><p className="mt-1 text-xs text-muted-foreground">Celebrating consistent outcomes—not candidate volume or mentor cohort size.</p></div><div className="mx-auto mt-9 flex max-w-4xl flex-col gap-4 md:flex-row md:items-end">{analysis.leaderboard.slice(0, 3).map((member) => <PodiumCard key={member.mentorId} member={member} />)}</div></section> : <section className="rounded-2xl border bg-card py-16 text-center"><Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-4 font-black">No placements this month</h2><p className="mt-1 text-sm text-muted-foreground">Choose another month or sync placement records first.</p></section>}

    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="ranking-title">
      <div className="flex flex-col justify-between gap-4 border-b p-5 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 id="ranking-title" className="font-black">Full team ranking</h2></div><p className="mt-1 text-xs text-muted-foreground">Contribution, consistency, company reach, and review quality in one view.</p></div><label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search team members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team members…" className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[62rem] text-left text-sm"><thead className="bg-muted/35 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{['Rank', 'Team member', 'Placements', 'Team share', 'Active days', 'Best day', 'Consistency', 'Companies', 'Verified', 'Review flags'].map((heading) => <th key={heading} className="px-4 py-3 font-black">{heading}</th>)}</tr></thead><tbody>{filtered.map((member) => <tr key={member.mentorId} className="border-t transition-colors hover:bg-muted/25"><td className="px-4 py-4"><span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black', member.rank <= 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-muted')}>#{member.rank}</span></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{initials(member.mentorName)}</div><div><p className="font-black">{member.mentorName}</p><p className="text-[11px] text-muted-foreground">{member.batches} batches represented</p></div></div></td><td className="px-4 py-4 text-lg font-black tabular-nums">{member.placements}</td><td className="px-4 py-4"><div className="w-24"><div className="mb-1 flex justify-between text-[10px] font-bold"><span>{member.contribution}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${member.contribution}%` }} /></div></div></td><td className="px-4 py-4 font-bold tabular-nums">{member.activeDays}</td><td className="px-4 py-4 font-bold tabular-nums">{member.bestDay}</td><td className="px-4 py-4"><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{member.currentStreak} day streak</span></td><td className="px-4 py-4 font-bold tabular-nums">{member.companies}</td><td className="px-4 py-4 font-bold tabular-nums text-emerald-600">{member.verified}</td><td className="px-4 py-4"><span className={cn('rounded-lg px-2 py-1 text-xs font-bold', member.needsReview ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300')}>{member.needsReview || 'Clear'}</span></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 p-4 md:hidden">{filtered.map((member) => <article key={member.mentorId} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{initials(member.mentorName)}</span><div><p className="font-black">{member.mentorName}</p><p className="text-xs text-muted-foreground">Rank #{member.rank} · {member.contribution}% share</p></div></div><span className="text-2xl font-black tabular-nums">{member.placements}</span></div><div className="mt-4 grid grid-cols-4 gap-2 border-t pt-3 text-center text-xs"><div><p className="font-black">{member.activeDays}</p><p className="text-muted-foreground">Days</p></div><div><p className="font-black">{member.bestDay}</p><p className="text-muted-foreground">Best</p></div><div><p className="font-black">{member.companies}</p><p className="text-muted-foreground">Companies</p></div><div><p className="font-black">{member.verified}</p><p className="text-muted-foreground">Verified</p></div></div></article>)}</div>
      {!filtered.length && <div className="border-t py-14 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground/40" /><p className="mt-3 font-black">No team members found</p><p className="mt-1 text-xs text-muted-foreground">Clear the search or choose another reporting month.</p></div>}
    </section>

    <section className="grid gap-4 sm:grid-cols-3"><div className="flex gap-3 rounded-xl border bg-card p-4"><Users className="h-5 w-5 shrink-0 text-primary" /><div><h3 className="text-sm font-black">Placements define rank</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Unique Discord placement messages are the primary ranking measure.</p></div></div><div className="flex gap-3 rounded-xl border bg-card p-4"><CalendarCheck className="h-5 w-5 shrink-0 text-primary" /><div><h3 className="text-sm font-black">Active days break ties</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">More distinct placement days ranks ahead when totals are equal.</p></div></div><div className="flex gap-3 rounded-xl border bg-card p-4"><Building2 className="h-5 w-5 shrink-0 text-primary" /><div><h3 className="text-sm font-black">Quality stays visible</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Verification and review flags are shown but never secretly change rank.</p></div></div></section>
  </div>;
}
