'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Clipboard, ExternalLink, FileKey2, FileSpreadsheet, Loader2, LockKeyhole, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { RHFCheckbox, RHFInput, RHFSelect } from '@/components/forms/rhf-fields';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import type { SheetConnectionView } from '@/lib/sheets/attachments';
import { SheetAttachmentSchema, type SheetAttachmentInput } from '@/lib/validators/sheet-attachment.schema';
import { placementMonthTab, scrumWeekTab, SHEET_ACCESS_MODE, SHEET_DOMAIN, SHEET_RESOURCE } from '@/constants';

interface ConnectionsResponse {
  configured: boolean;
  service_account_email: string | null;
  data: SheetConnectionView[];
}

const domainOptions = [
  { value: SHEET_DOMAIN.PLACEMENTS, label: 'Placements' },
  { value: SHEET_DOMAIN.SCRUM_UPDATES, label: 'Daily Scrum Updates' },
  { value: SHEET_DOMAIN.DAILY_GOALS, label: 'Daily Goals' },
  { value: SHEET_DOMAIN.WEEKLY_KPIS, label: 'Weekly KPIs' },
  { value: SHEET_DOMAIN.MONTHLY_KPIS, label: 'Monthly Goals' },
  { value: SHEET_DOMAIN.STUDENTS, label: 'Student Information' },
  { value: SHEET_DOMAIN.COMPANIES, label: 'Company Information' },
  { value: SHEET_DOMAIN.AUDIT_LOG, label: 'Audit Log' },
];

const domainLabels = Object.fromEntries(domainOptions.map((option) => [option.value, option.label]));

const defaults: SheetAttachmentInput = {
  domain: SHEET_DOMAIN.STUDENTS,
  batch: '',
  sheet_url: '',
  worksheet_name: '',
  access_mode: SHEET_ACCESS_MODE.READ_ONLY,
  protect_headers: false,
};

export function SheetAttachmentManager() {
  const queryClient = useQueryClient();
  const form = useForm<SheetAttachmentInput>({ resolver: zodResolver(SheetAttachmentSchema), defaultValues: defaults });
  const accessMode = form.watch('access_mode');
  const selectedDomain = form.watch('domain');
  const selectedScope = form.watch('batch');
  useEffect(() => {
    if (accessMode === SHEET_ACCESS_MODE.READ_ONLY) form.setValue('protect_headers', false);
  }, [accessMode, form]);
  useEffect(() => {
    if (selectedDomain === SHEET_DOMAIN.PLACEMENTS || selectedDomain === SHEET_DOMAIN.SCRUM_UPDATES) {
      const year = /^20\d{2}$/.test(selectedScope) ? selectedScope : String(new Date().getFullYear());
      if (selectedScope !== year) form.setValue('batch', year, { shouldValidate: true });
      form.setValue('worksheet_name', selectedDomain === SHEET_DOMAIN.PLACEMENTS ? placementMonthTab(year, '01') : scrumWeekTab(year, '01'), { shouldValidate: true });
      return;
    }
    const resource = Object.values(SHEET_RESOURCE).find((entry) => entry.domain === selectedDomain);
    if (resource) form.setValue('worksheet_name', resource.primaryTab, { shouldValidate: true });
  }, [form, selectedDomain, selectedScope]);

  const connections = useQuery<ConnectionsResponse>({
    queryKey: ['sheet-connections'],
    queryFn: async () => {
      const response = await fetch('/api/sheet-connections');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load sheet connections');
      return payload;
    },
  });

  const attachMutation = useMutation({
    mutationFn: async (values: SheetAttachmentInput) => {
      const response = await fetch('/api/sheet-connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to attach spreadsheet');
      return payload.data as SheetConnectionView;
    },
    onSuccess: async () => {
      toast.success('Private Google Sheet attached');
      form.reset(defaults);
      await queryClient.invalidateQueries({ queryKey: ['sheet-connections'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to attach spreadsheet'),
  });

  const copyServiceEmail = async () => {
    if (!connections.data?.service_account_email) return;
    await navigator.clipboard.writeText(connections.data.service_account_email);
    toast.success('Google principal email copied');
  };

  return (
    <div className="space-y-6">
      <Card className="gap-5 border-0 py-6 shadow-sm ring-1 ring-border">
        <CardHeader className="px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle className="flex items-center gap-2 font-bold"><Plus className="h-4 w-4 text-primary" /> Attach an operational Google Sheet</CardTitle><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">The server verifies access and stores the batch-scoped connection in the private Sheet Management spreadsheet.</p></div>
            <Badge variant="outline" className="w-fit rounded-full">Manager only</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-6">
          {connections.isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking Google Sheets configuration…</div> : !connections.data?.configured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><p className="text-sm font-bold">Server configuration required</p><p className="mt-1 text-xs leading-5 opacity-80">Configure the Apps Script gateway URL and secret plus GOOGLE_SHEET_MANAGEMENT_SPREADSHEET_ID.</p></div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => attachMutation.mutate(values))} className="space-y-5">
                {connections.data.service_account_email && <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100">Grant this Google identity access to the spreadsheet</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[11px] text-indigo-700 ring-1 ring-indigo-100 dark:bg-slate-950 dark:text-indigo-300 dark:ring-indigo-900">{connections.data.service_account_email}</code><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyServiceEmail}><Clipboard className="h-3.5 w-3.5" /> Copy</Button></div>
                </div>}
                <div className="grid gap-5 md:grid-cols-2">
                  <RHFSelect control={form.control} name="domain" label="Data domain" options={domainOptions} required />
                  <RHFSelect control={form.control} name="access_mode" label="Required access" options={[{ value: SHEET_ACCESS_MODE.READ_ONLY, label: 'Read only — import/source data' }, { value: SHEET_ACCESS_MODE.READ_WRITE, label: 'Read and write — operational data' }]} required />
                  <RHFInput control={form.control} name="batch" label="Year, batch, or scope key" placeholder={selectedDomain === SHEET_DOMAIN.PLACEMENTS || selectedDomain === SHEET_DOMAIN.SCRUM_UPDATES ? '2026' : 'WEB-12 or GLOBAL'} description={selectedDomain === SHEET_DOMAIN.PLACEMENTS || selectedDomain === SHEET_DOMAIN.SCRUM_UPDATES ? 'This workbook is assigned by calendar year.' : 'Use the same stable code everywhere. Use GLOBAL only for shared cross-batch data.'} required className="md:col-span-2" />
                  <RHFInput control={form.control} name="sheet_url" label="Google Sheet URL or ID" placeholder="https://docs.google.com/spreadsheets/d/…" description="Only docs.google.com spreadsheet URLs are accepted." required className="md:col-span-2" />
                  <RHFInput control={form.control} name="worksheet_name" label="Worksheet name" placeholder="Leave empty to use the first tab" description="The tab name must match exactly when provided." className="md:col-span-2" />
                  <RHFCheckbox control={form.control} name="protect_headers" label="Protect the header row" checkboxLabel="Restrict row 1 editing to the configured Google identity and spreadsheet owner." disabled={accessMode !== SHEET_ACCESS_MODE.READ_WRITE} className="md:col-span-2" />
                </div>
                <div className="flex justify-end"><Button type="submit" className="h-10 gap-2 rounded-xl px-5" disabled={attachMutation.isPending}>{attachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileKey2 className="h-4 w-4" />} Verify and attach</Button></div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-sm font-black">Attached spreadsheets</h2><p className="mt-1 text-xs text-muted-foreground">Full spreadsheet IDs remain server-side.</p></div><Badge variant="outline" className="rounded-full">{connections.data?.data.length ?? 0} connected</Badge></div>
        {connections.data?.data.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{connections.data.data.map((connection) => <Card key={connection.id} className="gap-4 border-0 py-5 shadow-sm ring-1 ring-border"><CardHeader className="flex-row items-start justify-between px-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></div><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{connection.batch}</Badge></CardHeader><CardContent className="px-5"><CardTitle className="text-sm font-bold">{connection.spreadsheet_title}</CardTitle><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary">{domainLabels[connection.domain]}</p><div className="mt-4 space-y-2 text-[11px] text-muted-foreground"><p>Worksheet: <span className="font-semibold text-foreground">{connection.worksheet_name}</span></p><p>Access: <span className="font-semibold text-foreground">{connection.access_mode === 'read_write' ? 'Read and write' : 'Read only'}</span></p><p>ID: <span className="font-mono text-foreground">{connection.id_hint}</span></p></div><a href={connection.spreadsheet_url} target="_blank" rel="noreferrer" className={`${buttonVariants({ variant: 'outline', size: 'sm' })} mt-4 w-full gap-2`}>Open Sheet <ExternalLink className="h-3.5 w-3.5" /></a>{connection.protected_headers && <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Header protected</p>}</CardContent></Card>)}</div> : !connections.isLoading && <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center"><FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" /><p className="mt-3 text-sm font-bold">No spreadsheets attached</p><p className="mt-1 text-xs text-muted-foreground">Configure Google Sheets and attach the first private spreadsheet.</p></div>}
      </section>

      <Card className="border-0 py-5 ring-1 ring-border"><CardContent className="grid gap-4 px-5 md:grid-cols-3"><SecurityItem icon={LockKeyhole} title="Restricted sharing" text="Keep General access restricted and share workbooks only with approved people and the Apps Script deploying account." /><SecurityItem icon={ShieldCheck} title="Protected ranges" text="Protect headers, formulas, IDs, role columns, and audit fields from accidental edits." /><SecurityItem icon={CheckCircle2} title="Minimal gateway" text="Apps Script performs only authenticated raw Sheet operations; application logic remains in Next.js." /></CardContent></Card>
    </div>
  );
}

function SecurityItem({ icon: Icon, title, text }: { icon: typeof LockKeyhole; title: string; text: string }) {
  return <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div><p className="text-xs font-bold">{title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text}</p></div></div>;
}
