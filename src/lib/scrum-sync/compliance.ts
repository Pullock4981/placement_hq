import { addDays, format, parseISO } from 'date-fns';
import type { ScrumUpdate } from '@/lib/scrum-sync/types';

const DAILY_TARGET = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*{1,2})?(?:daily\s+)?(?:target|today|plan)s?\b/i;
const DAILY_ACHIEVEMENT = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*{1,2})?(?:daily\s+)?(?:achievement|achievements|achieved|completed|yesterday)\b/i;
const WEEKLY_GOAL = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*{1,2})?weekly\s+goals?\b/i;

export function plainScrumText(value: string) {
  return value.replace(/^\s*#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
}

function dhakaMinutes(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return Number.POSITIVE_INFINITY;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 24);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function isScrumUpdateOnTime(record: ScrumUpdate) {
  return dhakaMinutes(record.posted_at) <= 22 * 60;
}

export function hasDailyScrumFormat(record: ScrumUpdate) {
  return DAILY_TARGET.test(record.raw_message) && DAILY_ACHIEVEMENT.test(record.raw_message);
}

function currentDhakaMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
}

export function getScrumCompliance(records: ScrumUpdate[], fromDate: string, toDate: string, today: string, nowMinutes = currentDhakaMinutes()) {
  const expectedDates = Array.from({ length: 5 }, (_, index) => format(addDays(parseISO(fromDate), index), 'yyyy-MM-dd')).filter((date) => date <= toDate);
  const dueDates = expectedDates.filter((date) => date < today || (date === today && nowMinutes >= 22 * 60));
  const recordsByDate = new Map<string, ScrumUpdate[]>();
  records.forEach((record) => recordsByDate.set(record.update_date, [...(recordsByDate.get(record.update_date) ?? []), record]));
  const onTimeDates = dueDates.filter((date) => (recordsByDate.get(date) ?? []).some(isScrumUpdateOnTime));
  const missedDates = dueDates.filter((date) => !onTimeDates.includes(date));
  const weeklyGoalsShared = (recordsByDate.get(fromDate) ?? []).some((record) => WEEKLY_GOAL.test(record.raw_message));
  const formattedDates = dueDates.filter((date) => (recordsByDate.get(date) ?? []).some(hasDailyScrumFormat));
  return {
    updatesShared: records.length,
    activeDays: new Set(records.map((record) => record.update_date).filter((date) => expectedDates.includes(date))).size,
    onTimeDays: onTimeDates.length,
    missedDates,
    dueDates,
    weeklyGoalsShared,
    formatMaintained: dueDates.length > 0 && weeklyGoalsShared && formattedDates.length === dueDates.length,
  };
}
