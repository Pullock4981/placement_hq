'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import type { PerformancePlanData } from '@/lib/performance/types';

export function MentorGoalFeedback() {
  const query = useQuery<PerformancePlanData>({
    queryKey: ['performance-plans'],
    queryFn: async () => {
      const response = await fetch('/api/performance-plans', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Unable to load goal feedback.');
      return payload.data;
    },
    retry: false,
  });
  const feedback = (query.data?.monthlyKpis ?? []).filter((goal) => goal.approval_status === 'pending' && goal.manager_note);
  if (!feedback.length) return null;
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/25">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300"><MessageSquareText className="h-4 w-4" />Manager feedback</p><h2 className="mt-2 text-lg font-black">Your monthly goals need an update</h2></div><Link href="/mentor/performance/monthly-goals" className="inline-flex items-center text-xs font-black text-amber-800 hover:underline dark:text-amber-200">Review and edit <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{feedback.map((goal) => <div key={goal.id} className="rounded-xl border border-amber-200 bg-background/80 p-4 dark:border-amber-900 dark:bg-amber-950/10"><p className="text-sm font-bold">{goal.title} · {goal.target_value}</p><p className="mt-2 text-sm text-muted-foreground">{goal.manager_note}</p></div>)}</div>
  </section>;
}
