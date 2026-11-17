'use client';

import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function PerformanceQuickActions() {
  const { user } = useAuth();
  const basePath = `/${user?.role ?? 'mentor'}/performance`;
  const items = [{
    href: `${basePath}/monthly-goals`,
    title: 'Monthly Goals',
    description: 'Submit goals, review manager comments, revise pending items, and track approved targets.',
    label: 'Open monthly goals',
    icon: Target,
    tone: 'from-violet-600 to-indigo-600',
  }];

  return (
    <section className="grid gap-4" aria-label="Performance planning">
      {items.map(({ href, title, description, label, icon: Icon, tone }) => (
        <Link key={href} href={href} className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:hover:border-violet-800">
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${tone}`} />
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${tone}`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black tracking-tight">{title}</h2>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violet-600" />
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                {label}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
