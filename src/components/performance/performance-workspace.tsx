'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, Check, Clock3, Loader2, Plus, Target, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RHFInput, RHFSelect, RHFTextarea } from '@/components/forms/rhf-fields';
import { PERFORMANCE_PLAN_TYPE, PERFORMANCE_UNIT, QUARTERS } from '@/constants';
import type { PerformanceMentorOption, PerformancePlanData } from '@/lib/performance/types';
import { MentorMonthlyGoalsSchema, MonthlyKpiSchema, QuarterlyOkrSchema, type MentorMonthlyGoalsInput, type MonthlyKpiInput, type QuarterlyOkrInput } from '@/lib/validators/performance-plan.schema';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

type WorkspaceKind = 'monthly' | 'quarterly';

const unitOptions = [
  { value: PERFORMANCE_UNIT.NUMBER, label: 'Number' },
  { value: PERFORMANCE_UNIT.PERCENT, label: 'Percent' },
  { value: PERFORMANCE_UNIT.CURRENCY, label: 'Currency' },
  { value: PERFORMANCE_UNIT.DAYS, label: 'Days' },
  { value: PERFORMANCE_UNIT.HOURS, label: 'Hours' },
  { value: PERFORMANCE_UNIT.SCORE, label: 'Score' },
];

async function fetchPlans(): Promise<PerformancePlanData> {
  const response = await fetch('/api/performance-plans', { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Unable to load performance plans.');
  return payload.data;
}

async function savePlan(input: MonthlyKpiInput | QuarterlyOkrInput) {
  const response = await fetch('/api/performance-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Unable to save the performance plan.');
  return payload.data;
}

async function updateMonthlyPlan(input: { id: string; agenda: string; target_value: string; notes: string }) {
  const response = await fetch('/api/performance-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Unable to update the monthly KPI.');
  return payload.data;
}

async function updatePlanApproval(input: { id: string; approval_status: 'approved' | 'rejected' }) {
  const response = await fetch('/api/performance-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Unable to update the approval status.');
  return payload.data;
}

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function MonthlyForm({ mentors, saving, onSubmit }: { mentors: PerformanceMentorOption[]; saving: boolean; onSubmit: (value: MonthlyKpiInput) => void }) {
  const form = useForm<MonthlyKpiInput>({
    resolver: zodResolver(MonthlyKpiSchema),
    defaultValues: { type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI, month: new Date().toISOString().slice(0, 7), mentor_id: '', mentor_email: '', mentor_name: '', agenda: 'Monthly placement', target_value: '', notes: '' },
  });
  const mentorId = form.watch('mentor_id');
  useEffect(() => {
    const mentor = mentors.find((candidate) => candidate.id === mentorId);
    form.setValue('mentor_email', mentor?.email ?? '', { shouldValidate: Boolean(mentor) });
    form.setValue('mentor_name', mentor?.name ?? '', { shouldValidate: Boolean(mentor) });
  }, [form, mentorId, mentors]);
  return (
    <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <RHFInput control={form.control} name="month" label="Reporting month" type="month" required />
      <RHFSelect control={form.control} name="mentor_id" label="Mentor" placeholder="Select a mentor" options={mentors.map((mentor) => ({ value: mentor.id, label: `${mentor.name} · ${mentor.email}` }))} required />
      <RHFInput control={form.control} name="target_value" label="Monthly placement goal" inputMode="numeric" placeholder="15" description="Fresh and rehired placements both count toward this target." required />
      <RHFTextarea control={form.control} name="notes" label="Manager note" placeholder="Optional guidance for this month" rows={3} />
      <Button className="h-11 w-full rounded-xl bg-violet-600 font-bold hover:bg-violet-700" disabled={saving || !mentors.length}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Set monthly goal</Button>
    </form></Form>
  );
}

function SelfMonthlyForm({ saving, onSubmit }: { saving: boolean; onSubmit: (value: MentorMonthlyGoalsInput) => void }) {
  const form = useForm<MentorMonthlyGoalsInput>({ resolver: zodResolver(MentorMonthlyGoalsSchema), defaultValues: { month: new Date().toISOString().slice(0, 7), goals: [{ agenda: 'Monthly placement', target_value: '' }] } });
  const goals = useFieldArray({ control: form.control, name: 'goals' });
  return <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
    <RHFInput control={form.control} name="month" label="Reporting month" type="month" required />
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_36px] gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><span>Agenda</span><span>Metric / goal</span><span /></div>
      {goals.fields.map((field, index) => <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_120px_36px] items-start gap-2 rounded-xl border bg-muted/20 p-2">
        <RHFInput control={form.control} name={`goals.${index}.agenda`} label="Agenda" aria-label={`Goal ${index + 1} agenda`} placeholder="Goal agenda" required className="space-y-0 [&_label]:sr-only" />
        <RHFInput control={form.control} name={`goals.${index}.target_value`} label="Metric" aria-label={`Goal ${index + 1} metric`} inputMode="numeric" placeholder="15" required className="space-y-0 [&_label]:sr-only" />
        <Button type="button" variant="ghost" size="icon" className="mt-0.5 h-10 w-9 text-muted-foreground hover:text-destructive" disabled={goals.fields.length === 1} onClick={() => goals.remove(index)}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <Button type="button" variant="outline" className="h-10 w-full rounded-xl border-dashed" disabled={goals.fields.length >= 10} onClick={() => goals.append({ agenda: '', target_value: '' })}><Plus className="mr-2 h-4 w-4" />Add another goal</Button>
    </div>
    <Button type="submit" className="h-11 w-full bg-violet-600 font-bold hover:bg-violet-700" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit for approval</Button>
  </form></Form>;
}

function MonthlyGoalActions({ record, teamView, saving, approvalAction, onUpdate, onApproval }: { record: PerformancePlanData['monthlyKpis'][number]; teamView: boolean; saving: boolean; approvalAction: 'approved' | 'rejected' | null; onUpdate: (input: { id: string; agenda: string; target_value: string; notes: string }) => void; onApproval: (input: { id: string; approval_status: 'approved' | 'rejected' }) => void }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(record.target_value));
  const [notes, setNotes] = useState(record.notes);
  const canSelfEdit = !teamView && record.approval_status === 'pending' && record.edit_count < 1;
  if (!teamView && !canSelfEdit) return null;
  if (!editing) return <div className="flex flex-wrap gap-2">{teamView && record.approval_status !== 'approved' && <Button size="sm" onClick={() => onApproval({ id: record.id, approval_status: 'approved' })} disabled={saving}>{approvalAction === 'approved' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{approvalAction === 'approved' ? 'Approving…' : 'Approve'}</Button>}<Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={saving}>Edit goal</Button>{teamView && record.approval_status !== 'rejected' && <Button variant="outline" size="sm" onClick={() => onApproval({ id: record.id, approval_status: 'rejected' })} disabled={saving}>{approvalAction === 'rejected' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{approvalAction === 'rejected' ? 'Rejecting…' : 'Reject'}</Button>}</div>;
  return <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[120px_1fr_auto]"><input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="numeric" className="h-9 rounded-lg border bg-background px-3" /><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Goal note" className="h-9 rounded-lg border bg-background px-3" /><Button size="sm" disabled={saving} onClick={() => { onUpdate({ id: record.id, agenda: record.title, target_value: target, notes }); setEditing(false); }}>Save</Button></div>;
}

function QuarterlyForm({ saving, onSubmit }: { saving: boolean; onSubmit: (value: QuarterlyOkrInput) => void }) {
  const form = useForm<QuarterlyOkrInput>({
    resolver: zodResolver(QuarterlyOkrSchema),
    defaultValues: { type: PERFORMANCE_PLAN_TYPE.QUARTERLY_OKR, year: String(new Date().getFullYear()), quarter: QUARTERS[Math.floor(new Date().getMonth() / 3)], objective: '', key_results: [{ title: '', target_value: '', unit: PERFORMANCE_UNIT.NUMBER }], notes: '' },
  });
  const results = useFieldArray({ control: form.control, name: 'key_results' });
  return (
    <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-3"><RHFInput control={form.control} name="year" label="Year" inputMode="numeric" required /><RHFSelect control={form.control} name="quarter" label="Quarter" options={QUARTERS.map((value) => ({ value, label: value }))} required /></div>
      <RHFTextarea control={form.control} name="objective" label="Objective" placeholder="Improve placement operations quality and speed" required rows={3} />
      <div className="space-y-3">
        <div className="flex items-center justify-between"><p className="text-xs font-bold text-foreground/80">Key results <span className="text-destructive">*</span></p><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" disabled={results.fields.length >= 5} onClick={() => results.append({ title: '', target_value: '', unit: PERFORMANCE_UNIT.NUMBER })}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>
        {results.fields.map((field, index) => <div key={field.id} className="space-y-3 rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-violet-600">Result {index + 1}</span>{results.fields.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => results.remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>}</div>
          <RHFInput control={form.control} name={`key_results.${index}.title`} label="Measurable result" placeholder="Reduce average turnaround to 2 days" required />
          <div className="grid grid-cols-2 gap-3"><RHFInput control={form.control} name={`key_results.${index}.target_value`} label="Target" inputMode="decimal" required /><RHFSelect control={form.control} name={`key_results.${index}.unit`} label="Unit" options={unitOptions} required /></div>
        </div>)}
      </div>
      <RHFTextarea control={form.control} name="notes" label="Notes" placeholder="Optional ownership or delivery context" rows={3} />
      <Button className="h-11 w-full rounded-xl bg-violet-600 font-bold hover:bg-violet-700" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add quarterly OKR</Button>
    </form></Form>
  );
}

export function PerformanceWorkspace({ kind }: { kind: WorkspaceKind }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const [selectedMentor, setSelectedMentor] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(kind === 'monthly' ? currentMonth : currentQuarter);
  const plans = useQuery({ queryKey: ['performance-plans'], queryFn: fetchPlans, retry: false });
  const mutation = useMutation({
    mutationFn: savePlan,
    onSuccess: () => { toast.success(kind === 'monthly' ? 'Monthly placement goal assigned.' : 'Quarterly OKR added.'); queryClient.invalidateQueries({ queryKey: ['performance-plans'] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const selfMonthlyMutation = useMutation({
    mutationFn: async (value: MentorMonthlyGoalsInput) => {
      const records = [];
      for (const goal of value.goals) records.push(await savePlan({ type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI, month: value.month, mentor_id: '', mentor_email: '', mentor_name: '', agenda: goal.agenda, target_value: goal.target_value, notes: '' }));
      return records;
    },
    onSuccess: () => { toast.success('Monthly goals submitted for approval.'); queryClient.invalidateQueries({ queryKey: ['performance-plans'] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateMutation = useMutation({ mutationFn: updateMonthlyPlan, onSuccess: () => { toast.success('Monthly KPI updated.'); queryClient.invalidateQueries({ queryKey: ['performance-plans'] }); }, onError: (error: Error) => toast.error(error.message) });
  const approvalMutation = useMutation({ mutationFn: updatePlanApproval, onSuccess: async (_, value) => { await queryClient.invalidateQueries({ queryKey: ['performance-plans'] }); toast.success(value.approval_status === 'approved' ? 'Performance plan approved.' : 'Performance plan rejected.'); }, onError: (error: Error) => toast.error(error.message) });
  const monthly = kind === 'monthly';
  const monthlyRecords = plans.data?.monthlyKpis ?? [];
  const quarterlyRecords = plans.data?.quarterlyOkrs ?? [];
  const teamView = plans.data?.scope === 'team';
  const visibleMonthlyRecords = monthlyRecords.filter((record) => (!teamView || record.month === selectedPeriod) && (selectedMentor === 'all' || record.user_id === selectedMentor));
  const visibleQuarterlyRecords = quarterlyRecords.filter((record) => !teamView || `${record.year}-${record.quarter}` === selectedPeriod);
  const records = monthly ? visibleMonthlyRecords : visibleQuarterlyRecords;
  const periodOptions = Array.from(new Set(monthly ? [currentMonth, ...monthlyRecords.map((record) => record.month)] : [currentQuarter, ...quarterlyRecords.map((record) => `${record.year}-${record.quarter}`)])).sort().reverse();
  const pendingCount = records.filter((record) => record.approval_status === 'pending').length;
  const approvedCount = records.filter((record) => record.approval_status === 'approved').length;

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 pb-10">
      <DashboardPageHeader eyebrow="Programming Hero · Performance Workspace" title={monthly ? 'Monthly Placement Goals' : 'Quarterly OKR Planning'} description={monthly ? 'Assign one placement target to each mentor and track progress automatically from synced placements.' : 'Turn quarterly priorities into focused objectives and measurable results.'} context={<span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Users className="h-4 w-4" />{plans.data?.scope === 'team' ? 'Team view' : 'Personal view'}</span>} />

      {teamView && <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-violet-200 bg-violet-50/60 shadow-sm dark:border-violet-900 dark:bg-violet-950/20"><CardContent className="flex items-center justify-between p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Current view</p><p className="mt-1 text-2xl font-black">{records.length}</p></div><Target className="h-6 w-6 text-violet-600" /></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/60 shadow-sm dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="flex items-center justify-between p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pending approval</p><p className="mt-1 text-2xl font-black">{pendingCount}</p></div><Clock3 className="h-6 w-6 text-amber-600" /></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20"><CardContent className="flex items-center justify-between p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Approved</p><p className="mt-1 text-2xl font-black">{approvedCount}</p></div><Check className="h-6 w-6 text-emerald-600" /></CardContent></Card>
      </div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-border">
          <CardHeader className="border-b"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><CardTitle className="flex items-center gap-3 text-base"><span>{monthly ? 'Monthly KPI approvals' : 'Quarterly OKR approvals'}</span><Badge variant="secondary">{records.length} total</Badge></CardTitle>{teamView && <div className="flex flex-col gap-2 sm:flex-row"><select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} className="h-10 min-w-44 rounded-xl border bg-background px-3 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15">{periodOptions.map((period) => <option key={period} value={period}>{monthly ? monthLabel(period) : period.replace('-', ' · ')}</option>)}</select>{monthly && <select value={selectedMentor} onChange={(event) => setSelectedMentor(event.target.value)} className="h-10 min-w-52 rounded-xl border bg-background px-3 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"><option value="all">All team members</option>{plans.data?.mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select>}</div>}</div></CardHeader>
          <CardContent className="p-0">
            {plans.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div> : plans.isError ? <div className="p-8 text-center text-sm text-destructive">{plans.error instanceof Error ? plans.error.message : 'Unable to load plans.'}</div> : records.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50"><Target className="h-6 w-6" /></div><h2 className="mt-4 font-black">No plans added yet</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">{monthly ? 'A Manager can assign one placement goal to each mentor for this month.' : 'Use the form to create the first quarterly OKR.'}</p></div> : <div className="divide-y">
              {monthly ? visibleMonthlyRecords.map((record) => { const approvalAction = approvalMutation.isPending && approvalMutation.variables?.id === record.id ? approvalMutation.variables.approval_status : null; return <article key={record.id} className="p-5 transition hover:bg-muted/25"><div className="flex flex-col gap-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline"><CalendarDays className="mr-1 h-3 w-3" />{monthLabel(record.month)}</Badge><Badge variant={record.approval_status === 'approved' ? 'default' : 'secondary'}>{record.approval_status}</Badge><Badge variant="outline">{record.plan_kind}</Badge></div><h2 className="mt-3 font-black">{record.user_name}</h2><p className="mt-1 text-sm font-semibold">{record.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{record.metric} · {record.team_role}</p></div><div className="grid shrink-0 grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-violet-50 px-3 py-2 dark:bg-violet-950/30"><p className="text-xl font-black text-violet-700 dark:text-violet-300">{record.target_value}</p><p className="text-[9px] font-bold uppercase text-muted-foreground">Goal</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30"><p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{record.achieved_count}</p><p className="text-[9px] font-bold uppercase text-muted-foreground">Achieved</p></div><div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30"><p className="text-xl font-black text-amber-700 dark:text-amber-300">{record.remaining_count}</p><p className="text-[9px] font-bold uppercase text-muted-foreground">Remaining</p></div></div></div><div><div className="mb-1.5 flex justify-between text-[11px] font-bold"><span>Progress</span><span>{record.progress_percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{ width: `${Math.min(100, record.progress_percent)}%` }} /></div>{record.notes && <p className="mt-3 text-xs leading-5 text-muted-foreground">{record.notes}</p>}</div><MonthlyGoalActions record={record} teamView={teamView} saving={updateMutation.isPending || approvalMutation.isPending} approvalAction={approvalAction} onUpdate={(value) => updateMutation.mutate(value)} onApproval={(value) => approvalMutation.mutate(value)} /></div></article>; }) : visibleQuarterlyRecords.map((record) => <article key={record.id} className="p-5 transition hover:bg-muted/25"><div className="flex flex-col gap-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{record.quarter} · {record.year}</Badge><Badge variant={record.approval_status === 'approved' ? 'default' : 'secondary'}>{record.approval_status}</Badge></div><h2 className="mt-3 font-black">{record.objective}</h2>{teamView && <p className="mt-1 text-xs font-bold text-violet-600">{record.user_name} · {record.role}</p>}</div>{teamView && <div className="flex gap-2"><Button size="sm" disabled={approvalMutation.isPending || record.approval_status === 'approved'} onClick={() => approvalMutation.mutate({ id: record.id, approval_status: 'approved' })}>{approvalMutation.isPending && approvalMutation.variables?.id === record.id && approvalMutation.variables.approval_status === 'approved' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}{approvalMutation.isPending && approvalMutation.variables?.id === record.id && approvalMutation.variables.approval_status === 'approved' ? 'Approving…' : 'Approve'}</Button><Button size="sm" variant="outline" disabled={approvalMutation.isPending || record.approval_status === 'rejected'} onClick={() => approvalMutation.mutate({ id: record.id, approval_status: 'rejected' })}>{approvalMutation.isPending && approvalMutation.variables?.id === record.id && approvalMutation.variables.approval_status === 'rejected' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}{approvalMutation.isPending && approvalMutation.variables?.id === record.id && approvalMutation.variables.approval_status === 'rejected' ? 'Rejecting…' : 'Reject'}</Button></div>}</div><div className="grid gap-2 sm:grid-cols-2">{record.key_results.map((result, index) => <div key={`${record.id}-${index}`} className="rounded-xl border bg-background p-3"><p className="text-sm font-semibold">{result.title}</p><p className="mt-2 flex items-center gap-1 text-xs font-black text-violet-600"><ArrowUpRight className="h-3.5 w-3.5" />{result.target_value} {result.unit}</p></div>)}</div></div></article>)}
            </div>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border xl:sticky xl:top-24"><CardHeader className="border-b"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">Create plan</p><CardTitle className="text-lg">{monthly ? (plans.data?.scope === 'team' ? 'Assign monthly KPI' : 'Submit monthly KPI') : 'Add quarterly OKR'}</CardTitle></CardHeader><CardContent className="pt-5">{monthly ? (plans.data?.scope === 'team' ? <MonthlyForm mentors={plans.data?.mentors ?? []} saving={mutation.isPending} onSubmit={(value) => mutation.mutate(value)} /> : <SelfMonthlyForm saving={selfMonthlyMutation.isPending} onSubmit={(value) => selfMonthlyMutation.mutate(value)} />) : <QuarterlyForm saving={mutation.isPending} onSubmit={(value) => mutation.mutate(value)} />}</CardContent></Card>
      </div>
    </div>
  );
}
