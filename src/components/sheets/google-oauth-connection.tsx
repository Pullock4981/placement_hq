'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GoogleOAuthStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  missingConfiguration: string[];
  backend: 'google_apis';
  demoMode: boolean;
}

export function GoogleOAuthConnection() {
  const queryClient = useQueryClient();
  const status = useQuery<GoogleOAuthStatus>({
    queryKey: ['google-oauth-status'],
    queryFn: async () => {
      const response = await fetch('/api/google/oauth/status');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to check Google OAuth');
      return payload;
    },
  });
  const disconnect = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google/oauth/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).message || 'Unable to disconnect Google');
    },
    onSuccess: async () => {
      toast.success('Google Drive connection removed');
      await queryClient.invalidateQueries({ queryKey: ['google-oauth-status'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to disconnect Google'),
  });
  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google/oauth/test', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to validate Google OAuth');
      return payload as { email: string };
    },
    onSuccess: (result) => toast.success(`Google OAuth verified for ${result.email}`),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to validate Google OAuth'),
  });

  return (
    <Card className="gap-5 overflow-hidden border-0 py-0 shadow-sm ring-1 ring-border">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Workbook ownership</p><h2 className="mt-1 text-lg font-black">Google OAuth connection</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-blue-100">Connect an Admin Google account to create private workbooks in Drive. Shared backend operations use Google APIs directly.</p></div>
          <Badge className="w-fit border-white/25 bg-white/15 text-white">Google APIs</Badge>
        </div>
      </div>
      <CardHeader className="px-6 pt-1"><CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-indigo-500" /> Server-side authorization</CardTitle></CardHeader>
      <CardContent className="px-6 pb-6">
        {status.isLoading ? <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking OAuth configuration…</div> : status.isError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{status.error instanceof Error ? status.error.message : 'Unable to check Google OAuth.'}</p> : status.data?.demoMode ? (
          <div className="rounded-xl border bg-muted/30 p-4"><p className="text-sm font-bold">Disabled in hosted demo mode</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use a private local or production environment with server-side OAuth credentials to test this connection.</p></div>
        ) : !status.data?.configured ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><p className="text-sm font-bold">OAuth environment setup required</p><p className="mt-1 text-xs leading-5 opacity-80">Add the following private server variables, then restart the application:</p><code className="mt-3 block break-words rounded-lg bg-white/70 p-3 text-[11px] dark:bg-slate-950/60">{status.data?.missingConfiguration.join(', ')}</code></div>
        ) : status.data.connected ? (
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/35 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Google account connected</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">{status.data.email}</p><p className="mt-1 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">Encrypted HTTP-only test session · bound to your PlacementHQ manager account</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>{testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test connection</Button><Button variant="outline" className="gap-2" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>{disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Disconnect</Button></div></div>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-indigo-500" /><div><p className="text-sm font-bold">Ready to connect</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">Only Admins can start this workbook-creation flow. Tokens stay encrypted in an HTTP-only cookie and never enter frontend JavaScript.</p></div></div><Button className="gap-2" onClick={() => window.location.assign('/api/google/oauth/connect')}>Connect Google Drive <ExternalLink className="h-4 w-4" /></Button></div>
        )}
      </CardContent>
    </Card>
  );
}
