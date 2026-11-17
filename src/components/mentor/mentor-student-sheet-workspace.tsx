'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileSpreadsheet, Link2, Loader2, RefreshCw, Save, ShieldAlert, Users } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { MENTOR_STUDENT_STATUSES } from '@/constants';
import { RHFCheckbox, RHFInput, RHFSelect } from '@/components/forms/rhf-fields';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MentorStudentRow, MentorStudentSheetConnection } from '@/lib/mentor-batch-sheets';
import { MentorStudentSheetAttachmentSchema, type MentorStudentSheetAttachmentInput } from '@/lib/validators/mentor-student-sheet.schema';

interface WorkspaceResponse {
  data: {
    connection: MentorStudentSheetConnection | null;
    students: MentorStudentRow[];
  };
}

const attachmentDefaults: MentorStudentSheetAttachmentInput = {
  sheet_url: '',
  worksheet_name: '',
  batch: '',
  level: 'Level-1',
  duration_months: 1,
  confirmed_public_view: false,
};

async function loadWorkspace(): Promise<WorkspaceResponse['data']> {
  const response = await fetch('/api/mentor/student-sheet', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Unable to load your student sheet');
  return payload.data;
}

export function MentorStudentSheetWorkspace() {
  const queryClient = useQueryClient();
  const [showAttachment, setShowAttachment] = useState(false);
  const form = useForm<MentorStudentSheetAttachmentInput>({
    resolver: zodResolver(MentorStudentSheetAttachmentSchema) as Resolver<MentorStudentSheetAttachmentInput>,
    defaultValues: attachmentDefaults,
  });
  const workspace = useQuery({ queryKey: ['mentor-student-sheet'], queryFn: loadWorkspace });
  const attach = useMutation({
    mutationFn: async (values: MentorStudentSheetAttachmentInput) => {
      const response = await fetch('/api/mentor/student-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to attach the student sheet');
      return payload.data as MentorStudentSheetConnection;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentor-student-sheet'] });
      form.reset(attachmentDefaults);
      setShowAttachment(false);
      toast.success('Student Google Sheet connected');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to attach the student sheet'),
  });
  const updateStatus = useMutation({
    mutationFn: async (input: { row_number: number; current_status: string; status_note: string }) => {
      const response = await fetch('/api/mentor/student-sheet', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update student status');
      return payload.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentor-student-sheet'] });
      toast.success('Student status saved to Google Sheets');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to update student status'),
  });

  const metrics = useMemo(() => {
    const students = workspace.data?.students ?? [];
    return {
      total: students.length,
      active: students.filter((student) => student.current_status.startsWith('Interview Attempt')).length,
      placed: students.filter((student) => ['Hired', 'Joined'].includes(student.current_status)).length,
    };
  }, [workspace.data?.students]);

  if (workspace.isLoading) return <StudentSheetSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 rounded-full text-[10px] font-black uppercase tracking-wider">Mentor workspace</Badge>
          <h1 className="text-2xl font-black tracking-tight">My mentees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Import a view-only mentor sheet into Placement DBMS, then manage interview and placement status here.</p>
        </div>
        {workspace.data?.connection && <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={cn('h-4 w-4', workspace.isFetching && 'animate-spin')} /> Refresh</Button><a className={cn(buttonVariants(), 'gap-2')} href={workspace.data.connection.spreadsheet_url} target="_blank" rel="noreferrer">Open Google Sheet <ExternalLink className="h-4 w-4" /></a></div>}
      </div>

      {workspace.isError && <Card className="border-red-200 bg-red-50/60 dark:border-red-950 dark:bg-red-950/20"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm font-semibold text-red-700 dark:text-red-300">{workspace.error instanceof Error ? workspace.error.message : 'Unable to load the student sheet.'}</p><Button size="sm" variant="outline" onClick={() => workspace.refetch()}>Try again</Button></CardContent></Card>}

      {(!workspace.data?.connection || showAttachment) && <AttachmentCard form={form} pending={attach.isPending} replacing={Boolean(workspace.data?.connection)} onCancel={() => setShowAttachment(false)} onSubmit={(values) => attach.mutate(values)} />}

      {workspace.data?.connection && !showAttachment && <>
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black">{workspace.data.connection.spreadsheet_title}</p><p className="mt-1 text-xs text-muted-foreground">Worksheet: <span className="font-semibold text-foreground">{workspace.data.connection.worksheet_name}</span></p></div></div>
            <div className="flex items-center gap-2"><Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">Connected</Badge><Button size="sm" variant="ghost" onClick={() => setShowAttachment(true)}>Replace link</Button></div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total mentees" value={metrics.total} tone="violet" />
          <MetricCard label="Interview pipeline" value={metrics.active} tone="blue" />
          <MetricCard label="Hired or joined" value={metrics.placed} tone="emerald" />
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
          <CardHeader className="border-b bg-muted/20 px-5"><div className="flex items-center justify-between"><div><CardTitle className="text-base">Mentee status</CardTitle><p className="mt-1 text-xs text-muted-foreground">Status and notes are saved in the managed Placement DBMS worksheet; the source sheet remains read-only.</p></div><Badge variant="outline" className="rounded-full">{workspace.data.students.length} rows</Badge></div></CardHeader>
          <CardContent className="p-0">
            {workspace.data.students.length ? <div className="overflow-x-auto"><Table className="min-w-[920px]"><TableHeader><TableRow><TableHead className="px-5">Mentee</TableHead><TableHead>Phone</TableHead><TableHead>Batch</TableHead><TableHead className="w-52">Current status</TableHead><TableHead className="min-w-72">Notes</TableHead><TableHead className="w-28 text-right pr-5">Action</TableHead></TableRow></TableHeader><TableBody>{workspace.data.students.map((student) => <StudentStatusRow key={student.row_number} student={student} saving={updateStatus.isPending && updateStatus.variables?.row_number === student.row_number} disabled={updateStatus.isPending} onSave={(value) => updateStatus.mutate(value)} />)}</TableBody></Table></div> : <div className="flex flex-col items-center px-6 py-14 text-center"><Users className="h-9 w-9 text-muted-foreground/40" /><p className="mt-3 text-sm font-black">No mentee rows imported</p></div>}
          </CardContent>
        </Card>
      </>}
    </div>
  );
}

function AttachmentCard({ form, pending, replacing, onCancel, onSubmit }: { form: ReturnType<typeof useForm<MentorStudentSheetAttachmentInput>>; pending: boolean; replacing: boolean; onCancel: () => void; onSubmit: (values: MentorStudentSheetAttachmentInput) => void }) {
  return <Card className="overflow-hidden border-violet-200/80 shadow-sm dark:border-violet-900"><CardHeader className="border-b bg-gradient-to-r from-violet-50 to-fuchsia-50 px-6 dark:from-violet-950/40 dark:to-fuchsia-950/20"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-5 w-5 text-violet-600" /> {replacing ? 'Import a replacement mentee sheet' : 'Import your mentee sheet'}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">The selected worksheet is copied into Placement DBMS. Required columns: student name, email, phone, batch, status, and notes.</p></CardHeader><CardContent className="p-6"><Form {...form}><form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}><div className="grid gap-4 md:grid-cols-2"><RHFInput control={form.control} name="sheet_url" label="Public Google Sheet link" placeholder="https://docs.google.com/spreadsheets/d/…" required className="md:col-span-2" /><RHFInput control={form.control} name="worksheet_name" label="Worksheet name" placeholder="Mentees" required /><RHFInput control={form.control} name="batch" label="Batch name" placeholder="Batch 13" required /><RHFSelect control={form.control} name="level" label="Level" options={[{ label: 'Level-1', value: 'Level-1' }, { label: 'Level-2', value: 'Level-2' }]} required /><RHFInput control={form.control} name="duration_months" label="Duration (months)" type="number" min={1} max={6} required /><RHFCheckbox control={form.control} name="confirmed_public_view" label="Sharing confirmation" checkboxLabel="I confirmed General access is set to Anyone with the link — Viewer." className="md:col-span-2" /></div><div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-5">PlacementHQ only reads the public source. Status and note edits are made in the private Placement DBMS copy.</p></div><div className="flex justify-end gap-2">{replacing && <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>}<Button type="submit" className="gap-2" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{pending ? 'Importing…' : 'Import mentees'}</Button></div></form></Form></CardContent></Card>;
}

function StudentStatusRow({ student, saving, disabled, onSave }: { student: MentorStudentRow; saving: boolean; disabled: boolean; onSave: (input: { row_number: number; current_status: string; status_note: string }) => void }) {
  const [status, setStatus] = useState(MENTOR_STUDENT_STATUSES.includes(student.current_status as never) ? student.current_status : MENTOR_STUDENT_STATUSES[0]);
  const [note, setNote] = useState(student.status_note);
  useEffect(() => { setStatus(MENTOR_STUDENT_STATUSES.includes(student.current_status as never) ? student.current_status : MENTOR_STUDENT_STATUSES[0]); setNote(student.status_note); }, [student.current_status, student.status_note]);
  const dirty = status !== student.current_status || note !== student.status_note;
  return <TableRow><TableCell className="px-5"><p className="font-bold">{student.student_name || 'Unnamed mentee'}</p><p className="mt-0.5 text-xs text-muted-foreground">{student.student_email || `Row ${student.row_number}`}</p></TableCell><TableCell className="text-xs">{student.phone || '—'}</TableCell><TableCell><Badge variant="outline">{student.batch || '—'}</Badge></TableCell><TableCell><Select value={status} onValueChange={setStatus} disabled={disabled}><SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{MENTOR_STUDENT_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input value={note} maxLength={500} disabled={disabled} onChange={(event) => setNote(event.target.value)} placeholder="Add a concise note" className="h-9" /></TableCell><TableCell className="pr-5 text-right"><Button size="sm" disabled={disabled || !dirty} onClick={() => onSave({ row_number: student.row_number, current_status: status, status_note: note })}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="sr-only">Save status</span></Button></TableCell></TableRow>;
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'violet' | 'blue' | 'emerald' }) {
  const tones = { violet: 'from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300', blue: 'from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-300', emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300' };
  return <Card className="border-0 shadow-sm ring-1 ring-border"><CardContent className={cn('rounded-xl bg-gradient-to-br p-5', tones[tone])}><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p></CardContent></Card>;
}

function StudentSheetSkeleton() {
  return <div className="space-y-5"><div className="h-20 animate-pulse rounded-2xl bg-muted/60" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/60" />)}</div><div className="h-80 animate-pulse rounded-2xl bg-muted/60" /></div>;
}
