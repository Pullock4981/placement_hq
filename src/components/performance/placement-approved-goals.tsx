'use client';

import { CheckCircle2, Target } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDashboardMonthlyGoals } from '@/components/performance/use-dashboard-monthly-goals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function normalize(value?: string) { return (value || '').trim().replace(/^@/, '').toLowerCase(); }

export function PlacementApprovedGoals() {
  const { user } = useAuth();
  const month = new Date().toISOString().slice(0, 7);
  const query = useDashboardMonthlyGoals(month);
  const approved = (query.data ?? []).filter((goal) => normalize(goal.approval_status) === 'approved');
  const goals = user?.role === 'mentor' ? approved.filter((goal) => goal.user_id === user.id || normalize(goal.user_email) === normalize(user.email) || (user.discord_user_id && goal.discord_user_id === user.discord_user_id)) : approved;
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

  return <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-sm dark:border-violet-900 dark:from-violet-950/30 dark:to-fuchsia-950/20">
    <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-5 w-5 text-violet-600" />Approved monthly goals</CardTitle><Badge variant="outline">{monthLabel}</Badge></div></CardHeader>
    <CardContent>{query.isLoading ? <div className="h-16 animate-pulse rounded-xl bg-muted" /> : goals.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{goals.map((goal) => <div key={`${goal.user_id}-${goal.title}`} className="rounded-xl border bg-background/85 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{user?.role === 'mentor' ? 'Your target' : goal.user_name}</p><p className="mt-1 text-sm font-bold">{goal.title}</p></div><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /></div><p className="mt-3 text-2xl font-black text-violet-700 dark:text-violet-300">{goal.target_value} <span className="text-xs text-muted-foreground">{goal.unit}</span></p></div>)}</div> : <p className="text-sm text-muted-foreground">No approved goals for this month. Pending goals appear after manager approval.</p>}</CardContent>
  </Card>;
}
