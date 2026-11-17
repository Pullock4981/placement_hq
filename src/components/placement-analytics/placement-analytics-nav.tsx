'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/manager/placement/tracker', label: 'Monthly tracker', icon: CalendarDays },
  { href: '/manager/placement/leaderboard', label: 'Placement leaderboard', icon: BarChart3 },
  { href: '/manager/placement', label: 'Sync records', icon: RefreshCw },
];

export function PlacementAnalyticsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Placement workspace" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(
          'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
          active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}><item.icon className="h-3.5 w-3.5" />{item.label}</Link>;
      })}
    </nav>
  );
}
