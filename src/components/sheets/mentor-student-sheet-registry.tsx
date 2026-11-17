'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileSpreadsheet, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MentorStudentSheetConnection } from '@/lib/mentor-batch-sheets';

export function MentorStudentSheetRegistry() {
  const query = useQuery<{ connections: MentorStudentSheetConnection[] }>({
    queryKey: ['mentor-student-sheet-registry'],
    queryFn: async () => {
      const response = await fetch('/api/mentor/student-sheet', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load mentor student sheets');
      return payload.data;
    },
  });
  return <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border"><CardHeader className="border-b bg-muted/20 px-6"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-violet-600" /> Mentor batch worksheets</CardTitle><p className="mt-1 text-xs text-muted-foreground">Active imports registered in the Placement DBMS <span className="font-mono">batchs</span> tab.</p></div><Badge variant="outline" className="rounded-full">{query.data?.connections.length ?? 0} active</Badge></div></CardHeader><CardContent className="p-6">{query.isLoading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading mentor batches…</div> : query.isError ? <p className="text-sm text-red-600">{query.error instanceof Error ? query.error.message : 'Unable to load mentor batches.'}</p> : query.data?.connections.length ? <div className="grid gap-3 md:grid-cols-2">{query.data.connections.map((connection) => <div key={connection.id} className="flex items-center gap-3 rounded-xl border p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{connection.mentor_name}</p><p className="truncate text-xs font-semibold text-violet-600">@{connection.discord_username} · {connection.batch}</p><p className="truncate text-[10px] text-muted-foreground">{connection.level} · {connection.duration_months} month{connection.duration_months === 1 ? '' : 's'} · Discord {connection.discord_user_id}</p><p className="mt-1 truncate text-[10px] font-semibold text-emerald-600">{connection.spreadsheet_title} · {connection.worksheet_name}</p></div><a href={connection.spreadsheet_url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}><ExternalLink className="h-4 w-4" /><span className="sr-only">Open managed worksheet</span></a></div>)}</div> : <div className="py-8 text-center"><FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground/40" /><p className="mt-2 text-sm font-bold">No mentor batches imported</p></div>}</CardContent></Card>;
}
