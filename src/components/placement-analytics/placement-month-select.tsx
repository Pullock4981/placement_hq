import { CalendarRange } from 'lucide-react';
import { formatPlacementMonth } from '@/lib/placement-analytics/analyze';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PlacementMonthSelect({ value, months, onChange, disabled }: {
  value: string; months: string[]; onChange: (month: string) => void; disabled?: boolean;
}) {
  const options = Array.from(new Set([value, ...months].filter(Boolean))).sort().reverse();
  return (
    <Select value={value} disabled={disabled || !value} onValueChange={onChange}>
      <SelectTrigger aria-label="Reporting month" className="group h-auto w-[13rem] rounded-xl border-violet-200/80 bg-gradient-to-br from-white to-violet-50/80 p-1.5 pr-2 shadow-sm transition hover:border-violet-300 hover:shadow-md focus:border-primary focus:ring-primary/15 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/15 dark:border-violet-900 dark:from-card dark:to-violet-950/30 [&>svg]:mr-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-violet-500">
        <span className="flex min-w-0 items-center gap-2 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"><CalendarRange className="h-3.5 w-3.5" /></span>
          <span className="min-w-0"><span className="block text-[8px] font-black uppercase tracking-[0.13em] text-violet-600 dark:text-violet-300">Reporting month</span><span className="block truncate text-xs font-black text-foreground"><SelectValue placeholder="Select month" /></span></span>
        </span>
      </SelectTrigger>
      <SelectContent align="end" sideOffset={6} className="max-h-72 min-w-[13rem] rounded-xl border-violet-200/80 bg-popover/95 p-1 shadow-2xl shadow-violet-950/15 backdrop-blur-xl dark:border-violet-900">
        {options.map((month) => <SelectItem key={month} value={month} className="my-0.5 rounded-lg py-2 pl-2.5 pr-8 text-xs font-semibold focus:bg-violet-100 focus:text-violet-950 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-indigo-600 data-[state=checked]:text-white dark:focus:bg-violet-950/60 dark:focus:text-violet-100">{formatPlacementMonth(month)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
