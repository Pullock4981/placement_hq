'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock3, Copy, FileSpreadsheet, ListChecks, RefreshCw, Send, Sparkles, Target, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getScrumCompliance, hasDailyScrumFormat, isScrumUpdateOnTime, plainScrumText } from '@/lib/scrum-sync/compliance';
import { dhakaToday, scrumCurrentWeek, scrumWeekRange } from '@/lib/scrum-sync/week';
import type { ScrumDashboardData, ScrumSyncPage, ScrumSyncRequest } from '@/lib/scrum-sync/types';
import type { WeeklyGoalsData } from '@/lib/weekly-goals/types';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

function SummaryInline({ value }: { value: string }) {
  return <>{value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</>;
}

function ScrumSummaryContent({ value }: { value: string }) {
  return <div className="text-sm leading-6">{value.split(/\r?\n/).map((line, index) => {
    if (!line.trim()) return <div key={index} className="h-2" />;
    if (line.startsWith('# ')) return <h2 key={index} className="mb-3 text-xl font-black tracking-tight text-foreground">{line.slice(2)}</h2>;
    if (line.startsWith('### ')) return <h3 key={index} className="mb-3 mt-5 border-t border-violet-200/60 pt-4 text-xs font-black uppercase tracking-[0.14em] text-violet-700 first:mt-0 dark:border-violet-900 dark:text-violet-300">{line.slice(4)}</h3>;
    if (line.startsWith('- ')) return <div key={index} className="mb-2 flex gap-2 pl-1"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" /><p><SummaryInline value={line.slice(2)} /></p></div>;
    if (line.startsWith('*') && line.endsWith('*')) return <p key={index} className="mt-6 border-t pt-4 text-xs italic text-muted-foreground">{line.slice(1, -1)}</p>;
    return <p key={index}><SummaryInline value={line} /></p>;
  })}</div>;
}

async function api(method: string, path = '', body?: unknown) {
  const requestBody = body ? JSON.stringify(body) : undefined;
  const request = () => fetch(`/api/scrum-sync${path}`, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(requestBody ? { body: requestBody } : {}),
  });
  let response = await request();
  if (response.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (refreshed.ok) response = await request();
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Scrum request failed.');
  return payload;
}

async function loadEmployeeWeeklyGoals(year: number, week: number, employee: string, email?: string) {
  const params = new URLSearchParams({ year: String(year), week: String(week), employee });
  if (email) params.set('email', email);
  const request = () => fetch(`/api/weekly-goals?${params}`, { cache: 'no-store', credentials: 'same-origin' });
  let response = await request();
  if (response.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (refreshed.ok) response = await request();
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Weekly goals could not be loaded.');
  return payload.data as WeeklyGoalsData;
}

const SCRUM_CACHE_TTL = 5 * 60_000;

function scrumCacheKey(year: number, week: number) {
  return `placementhq:scrum-week:v2:${year}:${week}`;
}

function readCachedScrum(year: number, week: number) {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = JSON.parse(sessionStorage.getItem(scrumCacheKey(year, week)) || 'null') as { updatedAt?: number; data?: ScrumDashboardData } | null;
    if (!cached?.data || !cached.updatedAt || Date.now() - cached.updatedAt > SCRUM_CACHE_TTL) return undefined;
    return cached;
  } catch {
    return undefined;
  }
}

export function ScrumUpdatesWorkspace() {
  const today = dhakaToday();
  const year = Number(today.slice(0, 4));
  const currentWeek = scrumCurrentWeek(today);
  const [week, setWeek] = useState(currentWeek);
  const [employee, setEmployee] = useState('all');
  const [busy, setBusy] = useState<'sync' | 'test' | 'summary' | 'dm' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const range = useMemo(() => scrumWeekRange(year, week, today), [today, week, year]);
  const { fromDate, toDate } = range;
  const cachedWeek = useMemo(() => readCachedScrum(year, week), [week, year]);
  const queryClient = useQueryClient();
  const query = useQuery<ScrumDashboardData>({
    queryKey: ['scrum-updates', year, week],
    queryFn: async () => {
      const value = await api('GET', `?year=${year}&fromDate=${fromDate}&toDate=${toDate}`) as ScrumDashboardData;
      try { sessionStorage.setItem(scrumCacheKey(year, week), JSON.stringify({ updatedAt: Date.now(), data: value })); } catch {}
      return value;
    },
    initialData: cachedWeek?.data,
    initialDataUpdatedAt: cachedWeek?.updatedAt,
    placeholderData: (previous) => previous ? { ...previous, records: [], employees: [], selectedWeekSynced: previous.syncedWeeks.includes(week), lastSyncedAt: null } : undefined,
    staleTime: SCRUM_CACHE_TTL,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = query.data;
  const ready = Boolean(data?.connectionReady && data.discordConfigured);
  const weekOptions = useMemo(() => Array.from({ length: currentWeek }, (_, index) => index + 1), [currentWeek]);
  const visibleRecords = useMemo(() => employee === 'all' ? data?.records ?? [] : (data?.records ?? []).filter((record) => record.employee_discord_id === employee), [data?.records, employee]);
  const compliance = useMemo(() => getScrumCompliance(visibleRecords, fromDate, toDate, today), [visibleRecords, fromDate, toDate, today]);
  const selectedEmployeeRecord = data?.employees.find((person) => person.id === employee);
  const selectedEmployee = selectedEmployeeRecord?.name;
  const weeklyGoalsQuery = useQuery({
    queryKey: ['manager-weekly-goals', year, week, employee],
    queryFn: () => loadEmployeeWeeklyGoals(year, week, employee, selectedEmployeeRecord?.email),
    enabled: employee !== 'all' && Boolean(selectedEmployeeRecord),
    retry: false,
    staleTime: 60_000,
  });
  const cleanSummary = summary.trim();

  useEffect(() => { setSummary(''); setCopied(false); setError(''); }, [employee, week]);

  async function testConnections() {
    setBusy('test'); setError(''); setMessage('');
    try {
      const result = await api('PATCH', `?year=${year}`);
      queryClient.setQueryData<ScrumDashboardData>(['scrum-updates', year, week], (previous) => previous ? { ...previous, ...result.status } : previous);
      setMessage(result.message);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection test failed.'); }
    finally { setBusy(null); }
  }

  async function sync() {
    setBusy('sync'); setError(''); setMessage('');
    let request: ScrumSyncRequest = { fromDate, toDate, runId: crypto.randomUUID() };
    const totals = { fetched: 0, inserted: 0, updated: 0, unchanged: 0, ignored: 0 };
    try {
      while (true) {
        const result = await api('POST', '', request) as ScrumSyncPage;
        (Object.keys(totals) as Array<keyof typeof totals>).forEach((key) => { totals[key] += result[key]; });
        if (result.complete) break;
        request = { ...request, cursor: result.nextCursor! };
      }
      setMessage(`Week ${week} synced · ${totals.inserted} new · ${totals.updated} updated.`);
      setSummary('');
      try { sessionStorage.removeItem(scrumCacheKey(year, week)); } catch {}
      queryClient.setQueryData<ScrumDashboardData>(['scrum-updates', year, week], (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          selectedWeekSynced: true,
          lastSyncedAt: new Date().toISOString(),
          syncedWeeks: Array.from(new Set([...previous.syncedWeeks, week])).sort((left, right) => left - right),
        };
      });
      await query.refetch({ cancelRefetch: false });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Scrum sync failed.'); }
    finally { setBusy(null); }
  }

  async function makeSummary() {
    setBusy('summary'); setError(''); setMessage(''); setCopied(false);
    try {
      const result = await api('POST', '/summary', { year, week, ...(employee !== 'all' ? { employee } : {}) });
      setSummary(result.summary);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Summary generation failed.'); }
    finally { setBusy(null); }
  }

  async function copySummary() {
    await navigator.clipboard.writeText(cleanSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function sendSummary() {
    if (employee === 'all' || !cleanSummary) return;
    setBusy('dm'); setError(''); setMessage('');
    try {
      const result = await api('POST', '/direct-message', { year, week, employee, summary: cleanSummary });
      setMessage(result.message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The Discord summary could not be sent.'); }
    finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-10">
      <DashboardPageHeader eyebrow="Programming Hero · Team Operations" title="Weekly Scrum Updates" description={`Review delivery, consistency, and blockers for Week ${week}.`} />

      {(error || query.error) && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error || (query.error as Error)?.message}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{message}</p>}

      <section className="grid items-stretch gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Weekly metrics</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/25"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Clock3 className="h-4 w-4" /></span><p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">On time</p><p className="mt-1 text-3xl font-black tabular-nums">{compliance.onTimeDays}</p><p className="mt-1 text-xs text-muted-foreground">Submitted by 10 PM</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/25"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /></span><p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Missed</p><p className="mt-1 text-3xl font-black tabular-nums">{compliance.missedDates.length}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={compliance.missedDates.join(', ')}>{compliance.missedDates.length ? compliance.missedDates.map((date) => format(parseISO(date), 'MMM d')).join(', ') : 'No missed updates'}</p></div>
        </CardContent></Card>

        <Card className="border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-violet-600" /> Reporting view</CardTitle></CardHeader><CardContent className="space-y-3">
          <label className="block rounded-xl border bg-muted/20 p-3"><span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Reporting week</span><NativeSelect className="w-full border-0 bg-card shadow-sm" value={String(week)} onChange={(event) => { setWeek(Number(event.target.value)); setEmployee('all'); }}>{weekOptions.map((number) => { const dates = scrumWeekRange(year, number, today); const synced = data?.syncedWeeks.includes(number); return <NativeSelectOption key={number} value={number}>Week {number} · {format(parseISO(dates.fromDate), 'MMM d')}–{format(parseISO(dates.toDate), 'MMM d')} · {synced ? 'Synced' : 'Not synced'}</NativeSelectOption>; })}</NativeSelect></label>
          <label className="block rounded-xl border bg-muted/20 p-3"><span className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><UserRound className="h-3 w-3" /> Employee</span><NativeSelect className="w-full border-0 bg-card shadow-sm" value={employee} disabled={query.isLoading || !data?.employees.length} onChange={(event) => setEmployee(event.target.value)}><NativeSelectOption value="all">All employees</NativeSelectOption>{data?.employees.map((person) => <NativeSelectOption key={person.id} value={person.id}>{person.name}</NativeSelectOption>)}</NativeSelect></label>
          <Button className="w-full" disabled={Boolean(busy) || query.isFetching || weeklyGoalsQuery.isFetching || query.isError || Boolean(error) || employee === 'all' || !visibleRecords.length} title={employee === 'all' ? 'Select an employee first' : undefined} onClick={() => void makeSummary()}><Sparkles className={busy === 'summary' ? 'animate-pulse' : ''} />{busy === 'summary' ? 'Creating summary…' : 'Create weekly summary'}</Button>
        </CardContent></Card>

        <Card className="border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4 text-violet-600" /> Sync status</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">{[['Workbook', data?.connectionReady], ['Discord', data?.discordConfigured]].map(([label, ok]) => <div key={String(label)} className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3"><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>{ok ? <CheckCircle2 className="h-4 w-4" /> : '!'}</span><div><p className="text-xs font-black">{label}</p><p className={cn('text-[10px] font-semibold', ok ? 'text-emerald-600' : 'text-muted-foreground')}>{ok ? 'Connected' : 'Unavailable'}</p></div></div>)}</div>
          <Button className="w-full" disabled={Boolean(busy) || !ready} onClick={() => void sync()}><RefreshCw className={cn('h-4 w-4', busy === 'sync' && 'animate-spin')} />{busy === 'sync' ? 'Syncing…' : data?.selectedWeekSynced ? `Re-sync week ${week}` : `Sync week ${week}`}</Button>
          <Button className="w-full" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void testConnections()}>{busy === 'test' ? 'Testing connections…' : 'Test connections'}</Button>
        </CardContent></Card>
      </section>

      {employee !== 'all' && <section aria-live="polite">
        {weeklyGoalsQuery.isLoading ? <div aria-label="Loading employee weekly goals" className="overflow-hidden rounded-2xl border border-violet-200/70 bg-card shadow-sm dark:border-violet-900/70"><div className="h-1.5 animate-pulse bg-gradient-to-r from-blue-500 to-violet-600" /><div className="space-y-4 p-5"><div className="h-5 w-48 animate-pulse rounded bg-muted" /><div className="grid gap-3 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted/70" />)}</div></div></div>
        : weeklyGoalsQuery.isError ? <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/20"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /></span><div><h2 className="font-black">Weekly goals are temporarily unavailable</h2><p className="mt-1 text-sm text-muted-foreground">{weeklyGoalsQuery.error instanceof Error ? weeklyGoalsQuery.error.message : 'Try selecting the employee again.'}</p></div></div></div>
        : weeklyGoalsQuery.data?.submission ? <div className="overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-blue-50/70 via-card to-violet-50/70 shadow-sm dark:border-violet-900/70 dark:from-blue-950/20 dark:to-violet-950/20"><div className="h-1.5 bg-gradient-to-r from-blue-500 to-violet-600" /><div className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><Target className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Saved weekly goals</p><h2 className="mt-1 text-lg font-black">{selectedEmployee} · Week {week}</h2><p className="mt-1 text-xs text-muted-foreground">{format(parseISO(weeklyGoalsQuery.data.week.start), 'MMM d')}–{format(parseISO(weeklyGoalsQuery.data.week.end), 'MMM d, yyyy')}</p></div></div><span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Submitted</span></div><div className="mt-5 grid gap-3 md:grid-cols-2">{weeklyGoalsQuery.data.submission.goals.map((goal, index) => <div key={`${index}-${goal}`} className="flex min-w-0 gap-3 rounded-xl border border-violet-200/60 bg-background/80 p-4 dark:border-violet-900/60"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">{index + 1}</span><p className="break-words text-sm font-semibold leading-6">{goal}</p></div>)}</div></div></div>
        : <div className="rounded-2xl border border-dashed border-violet-300 bg-gradient-to-r from-blue-50/60 to-violet-50/60 p-6 shadow-sm dark:border-violet-800 dark:from-blue-950/20 dark:to-violet-950/20"><div className="flex flex-col items-center text-center sm:flex-row sm:text-left"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><ListChecks className="h-5 w-5" /></span><div className="mt-3 sm:ml-4 sm:mt-0"><h2 className="font-black">No weekly goals submitted for Week {week}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedEmployee} has no saved goals for this reporting week. The AI summary will use only explicit goals found in the final Scrum update of the week.</p></div></div></div>}
      </section>}

      {cleanSummary && <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50/80 to-card shadow-sm dark:border-violet-900 dark:from-violet-950/25"><CardHeader className="flex-row items-center justify-between gap-3 border-b border-violet-200/60 py-4 dark:border-violet-900"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-violet-600" /> Weekly performance summary</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void copySummary()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button><Button size="sm" disabled={Boolean(busy) || employee === 'all'} onClick={() => void sendSummary()}><Send className="h-3.5 w-3.5" />{busy === 'dm' ? 'Sending…' : 'Send DM'}</Button></div></CardHeader><CardContent className="p-5"><ScrumSummaryContent value={cleanSummary} /></CardContent></Card>}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5"><div><h2 className="font-black">Weekly updates</h2><p className="mt-1 text-xs text-muted-foreground">{selectedEmployee || 'All employees'} · {format(parseISO(fromDate), 'MMM d')}–{format(parseISO(toDate), 'MMM d, yyyy')}</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{visibleRecords.length}</span></div>
        {query.isLoading || query.isPlaceholderData ? <div aria-label="Loading Scrum updates" className="space-y-3 p-5">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div> : !!visibleRecords.length ? <div className="overflow-x-auto"><Table className="min-w-[64rem]"><TableHeader><TableRow><TableHead className="w-36 px-5">Date</TableHead><TableHead className="px-5">Update</TableHead><TableHead className="w-32 px-5">Formatting</TableHead><TableHead className="w-40 px-5">Submission</TableHead></TableRow></TableHeader><TableBody>{visibleRecords.map((record) => { const formatOk = hasDailyScrumFormat(record); const onTime = isScrumUpdateOnTime(record); return <TableRow key={record.discord_message_id}><TableCell className="whitespace-normal px-5 align-top"><p className="font-black">{format(parseISO(record.update_date), 'EEE, MMM d')}</p><p className="mt-1 text-xs text-muted-foreground">{format(parseISO(record.posted_at), 'h:mm a')}</p></TableCell><TableCell className="whitespace-normal px-5 align-top"><p className="mb-2 text-xs font-black text-violet-700 dark:text-violet-300">{record.employee_name}</p><p className="whitespace-pre-wrap rounded-xl bg-muted/35 p-3 text-sm leading-6">{plainScrumText(record.raw_message) || 'No message content'}</p></TableCell><TableCell className="px-5 align-top"><span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-black', formatOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>{formatOk ? 'OK' : 'Review'}</span></TableCell><TableCell className="px-5 align-top"><span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-black', onTime ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{onTime ? 'On time' : 'Late'}</span><p className="mt-1 text-[10px] text-muted-foreground">Deadline 10 PM</p></TableCell></TableRow>; })}</TableBody></Table></div> : <div className="p-10 text-center text-sm text-muted-foreground">No updates found for this selection.</div>}
      </section>
    </div>
  );
}
