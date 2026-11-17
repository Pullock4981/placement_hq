'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, FilePlus2, FolderOpen, Loader2, ShieldCheck, TableProperties } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import type { GoogleSheetTemplateId } from '@/lib/validators/google-sheet-provision.schema';

interface GoogleOAuthStatus {
  connected: boolean;
  configured: boolean;
  demoMode: boolean;
  canManageSheets?: boolean;
  canManageDriveFiles?: boolean;
}

interface ProvisionedWorkbook {
  spreadsheetId: string;
  title: string;
  template: GoogleSheetTemplateId;
  templateLabel: string;
  year: number | null;
  spreadsheetUrl: string;
  tabs: string[];
  createdAt: string;
  folderName: string | null;
  folderUrl: string | null;
}

const templates: Record<GoogleSheetTemplateId, { label: string; description: string; defaultTitle: string }> = {
  placement_management: {
    label: 'Placement Management',
    description: 'Creates one annual workbook with 01_YYYY through 12_YYYY, placement_sync_log, and config.',
    defaultTitle: 'Placement Management',
  },
  scrum_management: {
    label: 'Daily Scrum Management',
    description: 'Creates W01_YYYY through W53_YYYY, scrum_sync_log, and config for employee updates.',
    defaultTitle: 'Daily Scrum Management',
  },
  performance_management: {
    label: 'Monthly Goals',
    description: 'Creates performance_plans and weekly_goals tabs for mentor goals, reviews, and progress.',
    defaultTitle: 'PlacementHQ Monthly Goals',
  },
  central_system: {
    label: 'Central System',
    description: 'Creates users, batches, sheets, audit_log, and system_config for the PlacementHQ data registry.',
    defaultTitle: 'PlacementHQ - DBMS',
  },
};

export function GoogleSheetProvisioner() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [template, setTemplate] = useState<GoogleSheetTemplateId>('placement_management');
  const [title, setTitle] = useState(`${templates.placement_management.defaultTitle} ${currentYear}`);
  const [year, setYear] = useState(currentYear);
  const [folderName, setFolderName] = useState('PlacementHQ');
  const status = useQuery<GoogleOAuthStatus>({
    queryKey: ['google-oauth-status'],
    queryFn: async () => {
      const response = await fetch('/api/google/oauth/status');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to check Google OAuth');
      return payload;
    },
  });
  const provision = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google/sheets/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, template, ...((template === 'placement_management' || template === 'scrum_management') ? { year } : {}), ...(folderName.trim() ? { folderName: folderName.trim() } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to create workbook');
      return payload.data as ProvisionedWorkbook;
    },
    onSuccess: async (workbook) => {
      toast.success(`${workbook.title} is ready in Google Drive`);
      await queryClient.invalidateQueries({ queryKey: ['sheet-connections'] });
      await queryClient.invalidateQueries({ queryKey: ['performance-plans'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to create workbook'),
  });

  const hasWorkbookAccess = Boolean(status.data?.canManageSheets && status.data?.canManageDriveFiles);
  const canCreate = Boolean(status.data?.connected && hasWorkbookAccess && !status.data.demoMode && title.trim().length >= 3);
  const handleTemplateChange = (nextTemplate: GoogleSheetTemplateId) => {
    setTemplate(nextTemplate);
    setTitle(nextTemplate === 'placement_management' || nextTemplate === 'scrum_management' ? `${templates[nextTemplate].defaultTitle} ${year}` : templates[nextTemplate].defaultTitle);
    provision.reset();
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canCreate) provision.mutate();
  };

  return (
    <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
      <CardHeader className="border-b bg-muted/20 px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><FilePlus2 className="h-5 w-5 text-emerald-600" /> Create managed workbook</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">Create a private Google Sheet in the connected account and apply the PlacementHQ tabs, headers, filters, formatting, and header warnings automatically.</p></div>
          <Badge variant="outline" className="w-fit rounded-full">OAuth creation · Central registry</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        <form className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[0.8fr_0.55fr_1fr_1fr_auto] xl:items-end" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="workbook-template">Workbook template</Label><NativeSelect id="workbook-template" className="w-full" value={template} disabled={provision.isPending} onChange={(event) => handleTemplateChange(event.target.value as GoogleSheetTemplateId)}><NativeSelectOption value="placement_management">Placement Management</NativeSelectOption><NativeSelectOption value="scrum_management">Daily Scrum Management</NativeSelectOption><NativeSelectOption value="performance_management">Performance Management</NativeSelectOption><NativeSelectOption value="central_system">Central System</NativeSelectOption></NativeSelect></div>
          <div className="space-y-2"><Label htmlFor="workbook-title">Google Sheet title</Label><Input id="workbook-title" value={title} maxLength={100} disabled={provision.isPending} onChange={(event) => { setTitle(event.target.value); provision.reset(); }} placeholder="Placement Management" /></div>
          {(template === 'placement_management' || template === 'scrum_management') && <div className="space-y-2"><Label htmlFor="workbook-year">Workbook year</Label><Input id="workbook-year" type="number" min={2020} max={2100} value={year} disabled={provision.isPending} onChange={(event) => { const nextYear = Number(event.target.value); setYear(nextYear); if (/^(Placement Management|Daily Scrum Management) \d{4}$/.test(title)) setTitle(`${templates[template].defaultTitle} ${nextYear}`); provision.reset(); }} /></div>}
          <div className="space-y-2"><Label htmlFor="workbook-folder">Drive folder <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="workbook-folder" value={folderName} maxLength={80} disabled={provision.isPending} onChange={(event) => { setFolderName(event.target.value); provision.reset(); }} placeholder="Leave empty for My Drive" /></div>
          <Button type="submit" className="gap-2" disabled={!canCreate || provision.isPending}>{provision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}{provision.isPending ? 'Creating…' : 'Create & setup'}</Button>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex gap-2 rounded-xl border bg-muted/20 p-3"><TableProperties className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">{templates[template].label}:</span> {templates[template].description}</p></div><div className="flex gap-2 rounded-xl border bg-muted/20 p-3"><FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">PlacementHQ creates or reuses an accessible top-level folder with this name. Leave it empty to save directly in My Drive.</p></div></div>

        {!status.isLoading && !status.data?.connected && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Connect Google in the card above before creating a workbook.</p>}
        {!status.isLoading && status.data?.connected && !hasWorkbookAccess && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">This connection is missing Google Sheets or Drive file permission. Disconnect Google, reconnect it, and approve both requested permissions.</p>}
        {provision.isError && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{provision.error instanceof Error ? provision.error.message : 'Unable to create workbook.'}</p>}
        {provision.data && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-black text-emerald-950 dark:text-emerald-100">{provision.data.title} is ready</p><p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">Created {provision.data.tabs.length} managed tabs: {provision.data.tabs.join(', ')}.</p></div></div><a href={provision.data.spreadsheetUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 bg-white/70 dark:bg-slate-950/40')}>Open Google Sheet <ExternalLink className="h-4 w-4" /></a></div>
            <div className="mt-4 flex gap-2 border-t border-emerald-200 pt-4 text-[11px] leading-5 text-emerald-800 dark:border-emerald-900 dark:text-emerald-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>The private file is registered automatically in the Central sheets tab. Header protection uses warnings so approved editors can still make deliberate changes.</p></div>
            {provision.data.folderName && <p className="mt-3 text-[11px] text-emerald-800 dark:text-emerald-200">Saved in <a className="font-bold underline underline-offset-4" href={provision.data.folderUrl ?? '#'} target="_blank" rel="noreferrer">{provision.data.folderName}</a>.</p>}
            {provision.data.template === 'central_system' && <p className="mt-3 rounded-lg bg-white/60 p-3 text-[11px] leading-5 text-amber-900 dark:bg-slate-950/40 dark:text-amber-200">This creates a new central workbook but does not switch the running app to it. Update the app&apos;s central Sheet configuration only after reviewing and migrating data.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
