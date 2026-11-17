import type { LucideIcon } from 'lucide-react';

export function PlacementKpi({ label, value, helper, icon: Icon, tone }: {
  label: string; value: string | number; helper: string; icon: LucideIcon; tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black tracking-tight tabular-nums">{value}</p></div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}
