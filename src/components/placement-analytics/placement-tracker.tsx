'use client';

import { Building2, CalendarDays, CircleHelp, Sparkles, Trophy, Users } from 'lucide-react';
import { PlacementPageHeader } from './placement-page-header';
import { PlacementMonthSelect } from './placement-month-select';
import { PlacementKpi } from './placement-kpi';
import { usePlacementAnalytics } from './use-placement-analytics';
import { formatPlacementMonth } from '@/lib/placement-analytics/analyze';
import { cn } from '@/lib/utils';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TrackerLoading() {
  return <div className="space-y-5" aria-label="Loading placement tracker"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div><div className="h-[34rem] animate-pulse rounded-2xl bg-muted" /></div>;
}

export function PlacementTracker() {
  const analytics = usePlacementAnalytics();
  if (analytics.isPending) return <TrackerLoading />;
  if (analytics.error || !analytics.analysis || !analytics.data) return <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{analytics.error instanceof Error ? analytics.error.message : 'Placement tracker data is unavailable.'}</div>;
  const { analysis, data } = analytics;
  const topContributor = analysis.leaderboard[0];
  return (
    <div className="mx-auto max-w-[92rem] space-y-5 pb-10">
      <PlacementPageHeader eyebrow="Placement intelligence" title="Monthly placement tracker" description="See every placement day at a glance, including the total placed and each team member’s contribution for that day." />

      <section className="flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
        <div><h2 className="font-black">{formatPlacementMonth(analysis.selectedMonth)} overview</h2><p className="mt-1 text-xs text-muted-foreground">Posting dates use Asia/Dhaka. Every unique Discord message is counted once.</p></div>
        <PlacementMonthSelect value={analytics.month} months={data.availableMonths} onChange={analytics.setMonth} disabled={analytics.isFetching} />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlacementKpi label="Total placements" value={analysis.totalPlacements} helper={`${analysis.averagePerActiveDay} average per active placement day`} icon={Trophy} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
        <PlacementKpi label="Active days" value={`${analysis.activeDays}/${analysis.daysInMonth}`} helper={analysis.peakDay ? `Peak: ${analysis.peakDay.date} with ${analysis.peakDay.total}` : 'No placements recorded this month'} icon={CalendarDays} tone="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" />
        <PlacementKpi label="Contributors" value={analysis.contributors} helper={topContributor ? `${topContributor.mentorName} leads with ${topContributor.placements}` : 'No contributor activity'} icon={Users} tone="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" />
        <PlacementKpi label="Companies reached" value={analysis.companies.length} helper={`${analysis.batches.length} student batches represented`} icon={Building2} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="placement-calendar-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div><h2 id="placement-calendar-title" className="font-black">Daily placement calendar</h2><p className="mt-1 text-xs text-muted-foreground">The large number is the daily total; the rows underneath show each contributing member and count.</p></div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Placement activity</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted" />No activity</span></div>
        </div>
        <div className="overflow-x-auto p-3 sm:p-5">
          <div className="min-w-[58rem]">
            <div className="mb-2 grid grid-cols-7 gap-2">{weekdays.map((weekday, index) => <div key={weekday} className={cn('px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground', index === 5 && 'text-emerald-600', index === 6 && 'text-violet-600')}>{weekday}</div>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: analysis.startWeekday }, (_, index) => <div key={`empty-${index}`} aria-hidden="true" className="min-h-36 rounded-xl border border-dashed bg-muted/10" />)}
              {analysis.days.map((day) => <article key={day.date} aria-label={`${day.date}: ${day.total} placements`} className={cn('min-h-36 rounded-xl border p-3 transition-all', day.total ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/70 dark:from-emerald-950/35 dark:to-card' : 'bg-muted/20')}>
                <div className="flex items-start justify-between gap-2"><span className="text-xs font-black text-muted-foreground">{String(day.day).padStart(2, '0')}</span>{day.total > 0 && <span className="rounded-lg bg-emerald-600 px-2 py-1 text-base font-black leading-none text-white shadow-sm" title={`${day.total} placements`}>{day.total}</span>}</div>
                {day.total > 0 ? <div className="mt-3 space-y-1.5">{day.mentors.map((mentor) => <div key={mentor.id} className="flex items-center justify-between gap-1 rounded-md border border-emerald-100 bg-white/80 px-2 py-1 text-[10px] dark:border-emerald-900/70 dark:bg-background/70"><span className="truncate font-bold" title={mentor.name}>{mentor.name}</span><span className="rounded bg-emerald-100 px-1.5 font-black tabular-nums text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{mentor.count}</span></div>)}</div> : <div className="flex h-24 items-center justify-center text-[10px] font-semibold text-muted-foreground/60">No placements</div>}
              </article>)}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="font-black">Contributor pulse</h2></div><p className="mt-1 text-xs text-muted-foreground">Month-to-date contribution based on synchronized placement messages.</p>
          <div className="mt-5 space-y-4">{analysis.leaderboard.slice(0, 8).map((member) => <div key={member.mentorId}><div className="mb-1.5 flex items-center justify-between gap-4 text-xs"><span className="font-bold">#{member.rank} {member.mentorName}</span><span className="font-black tabular-nums">{member.placements} · {member.contribution}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${Math.max(3, member.contribution)}%` }} /></div></div>)}</div>
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h2 className="font-black">Company distribution</h2></div><p className="mt-1 text-xs text-muted-foreground">Where the team’s placements landed this month.</p>
          <div className="mt-4 space-y-3">{analysis.companies.slice(0, 7).map((company, index) => <div key={company.name} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-black">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{company.name}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${company.share}%` }} /></div></div><span className="text-xs font-black tabular-nums">{company.count}</span></div>)}{!analysis.companies.length && <p className="py-8 text-center text-sm text-muted-foreground">No company data for this month.</p>}</div>
        </section>
      </div>

      <section className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="font-black">How this tracker is calculated</h2><p className="mt-1 text-xs leading-5 opacity-80">A placement belongs to the Dhaka calendar day when its Discord message was posted. Duplicate message IDs count once. Member totals use the Discord author saved as mentor; blank authors appear as “Unassigned mentor”. Verification status does not change the placement count, while malformed posts remain visible for operational review.</p></div></section>
    </div>
  );
}
