'use client';

import { useState, type ComponentProps } from 'react';
import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { CalendarDays, Globe2 } from 'lucide-react';
import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import { cn } from '@/lib/utils';

type PlacementDateRangePickerProps = {
  fromDate: string;
  toDate: string;
  today: string;
  disabled?: boolean;
  onChange: (fromDate: string, toDate: string) => void;
};

const minimumDate = parseISO('2015-01-01');
const navigationClassName = 'flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';
const presetClassName = 'rounded-full border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function CalendarNavigationButton(props: ComponentProps<'button'>) {
  return <button {...props} disabled={props.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true'} />;
}

export function PlacementDateRangePicker({ fromDate, toDate, today, disabled = false, onChange }: PlacementDateRangePickerProps) {
  const currentDay = parseISO(today);
  const selected: DateRange | undefined = fromDate
    ? { from: parseISO(fromDate), to: toDate ? parseISO(toDate) : undefined }
    : undefined;
  const [month, setMonth] = useState(() => startOfMonth(selected?.from ?? currentDay));
  const choosingEnd = Boolean(selected?.from && !selected.to);
  const dayCount = selected?.from && selected.to ? differenceInCalendarDays(selected.to, selected.from) + 1 : 0;
  const disabledDays: Matcher[] = [{ before: minimumDate }];

  if (choosingEnd && selected?.from) {
    disabledDays.push({ before: addDays(selected.from, -92) }, { after: addDays(selected.from, 92) });
  }

  const presets = [
    { label: 'Today', from: currentDay, to: currentDay },
    { label: 'Last 7 days', from: addDays(currentDay, -6), to: currentDay },
    { label: 'Last 30 days', from: addDays(currentDay, -29), to: currentDay },
    { label: 'This month', from: startOfMonth(currentDay), to: currentDay },
    { label: 'Last month', from: startOfMonth(subMonths(currentDay, 1)), to: endOfMonth(subMonths(currentDay, 1)) },
  ];

  function selectRange(range: DateRange | undefined) {
    onChange(range?.from ? format(range.from, 'yyyy-MM-dd') : '', range?.to ? format(range.to, 'yyyy-MM-dd') : '');
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 p-3 sm:p-6">
        <div className="mx-auto max-w-sm">
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-primary" />
            Select a date range
          </div>
          <DayPicker
            aria-label="Placement posting dates"
            aria-describedby="placement-calendar-help"
            mode="range"
            required
            resetOnSelect
            selected={selected}
            onSelect={selectRange}
            max={92}
            month={month}
            onMonthChange={setMonth}
            startMonth={minimumDate}
            today={currentDay}
            disabled={disabled || disabledDays}
            disableNavigation={disabled}
            showOutsideDays={false}
            fixedWeeks
            className="w-full"
            components={{ PreviousMonthButton: CalendarNavigationButton, NextMonthButton: CalendarNavigationButton }}
            classNames={{
              months: 'relative',
              month: 'w-full',
              month_caption: 'mb-5 flex h-9 items-center pr-20 text-base font-semibold',
              caption_label: 'select-none',
              nav: 'absolute right-0 top-0 flex gap-1',
              button_previous: navigationClassName,
              button_next: navigationClassName,
              chevron: 'h-4 w-4 fill-current',
              month_grid: 'w-full table-fixed border-collapse',
              weekday: 'pb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
              week: 'border-y-4 border-transparent',
              day: 'p-0 text-center align-middle',
              day_button: 'relative flex aspect-square w-full items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-primary/10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30',
              range_start: 'rounded-l-full bg-primary/10 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
              range_middle: 'bg-primary/10 text-primary',
              range_end: 'rounded-r-full bg-primary/10 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
              today: '[&>button]:font-extrabold [&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4',
              hidden: 'invisible',
            }}
          />
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Globe2 aria-hidden="true" className="h-3.5 w-3.5" /> Asia/Dhaka (UTC+06:00)
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t bg-muted/25 p-4 sm:p-6 md:border-l md:border-t-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick selection</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = fromDate === format(preset.from, 'yyyy-MM-dd') && toDate === format(preset.to, 'yyyy-MM-dd');
            return (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                className={cn(presetClassName, active && 'border-primary/40 bg-primary/10 text-primary')}
                onClick={() => {
                  selectRange({ from: preset.from, to: preset.to });
                  setMonth(startOfMonth(preset.from));
                }}
              >{preset.label}</button>
            );
          })}
        </div>

        <div className="mt-6" role="status" aria-live="polite" aria-atomic="true">
          <dl className="space-y-3 rounded-xl border bg-card p-4">
            <div>
              <dt className="text-xs text-muted-foreground">From date</dt>
              <dd className="mt-1 text-sm font-semibold">{selected?.from ? format(selected.from, 'EEE, d MMM yyyy') : 'Select a start date'}</dd>
            </div>
            <div className="border-t pt-3">
              <dt className="text-xs text-muted-foreground">Through date</dt>
              <dd className={cn('mt-1 text-sm font-semibold', !selected?.to && 'text-primary')}>{selected?.to ? format(selected.to, 'EEE, d MMM yyyy') : 'Select an end date'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-semibold text-primary">
            {dayCount ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'} selected · both dates included` : choosingEnd ? 'Now choose the end date' : 'Choose your first date'}
          </p>
        </div>

        <p id="placement-calendar-help" className="mt-3 text-xs leading-5 text-muted-foreground">
          {disabled
            ? 'Date selection is locked during setup or while a sync is active or resumable.'
            : 'Click a start date, then an end date. Click the same date twice for a single day. A range can include up to 93 days.'}
        </p>
        <button
          type="button"
          disabled={disabled || !fromDate}
          onClick={() => onChange('', '')}
          className="mt-4 self-start rounded text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >Clear selection</button>
      </div>
    </div>
  );
}
