import { PlacementAnalyticsNav } from './placement-analytics-nav';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

export function PlacementPageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <DashboardPageHeader eyebrow={eyebrow} title={title} description={description} context={<div className="w-fit rounded-xl bg-white/95 p-1 text-slate-950 shadow-lg"><PlacementAnalyticsNav /></div>} />;
}
