import { addDays, addWeeks, differenceInCalendarDays, format, min, parseISO } from 'date-fns';

export function dhakaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function scrumCurrentWeek(today = dhakaToday()) {
  return scrumWeekNumber(today);
}

function firstSaturday(year: number) {
  const firstDay = parseISO(`${year}-01-01`);
  return addDays(firstDay, (6 - firstDay.getDay() + 7) % 7);
}

export function scrumWeekNumber(date: string) {
  const parsed = parseISO(date);
  const first = firstSaturday(Number(date.slice(0, 4)));
  return Math.max(1, Math.floor(differenceInCalendarDays(parsed, first) / 7) + 1);
}

export function scrumWeekRange(year: number, week: number, today = dhakaToday()) {
  const start = addWeeks(firstSaturday(year), week - 1);
  const calendarEnd = parseISO(`${year}-12-31`);
  const unclampedEnd = min([addDays(start, 6), calendarEnd]);
  const currentDate = parseISO(today);
  const end = year === Number(today.slice(0, 4)) ? min([unclampedEnd, currentDate]) : unclampedEnd;
  return {
    fromDate: format(start, 'yyyy-MM-dd'),
    toDate: format(end, 'yyyy-MM-dd'),
  };
}
