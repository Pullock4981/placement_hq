import { describe, expect, it } from 'vitest';
import { getScrumCompliance, hasDailyScrumFormat, isScrumUpdateOnTime, plainScrumText } from '@/lib/scrum-sync/compliance';
import type { ScrumUpdate } from '@/lib/scrum-sync/types';

function update(date: string, postedAt: string, message: string): ScrumUpdate {
  return {
    discord_message_id: `${date}-${postedAt}`,
    posted_at: postedAt,
    update_date: date,
    week_key: '2026-W36',
    employee_discord_id: 'employee-1',
    employee_name: 'Mentor One',
    employee_email: '',
    yesterday: '',
    today: '',
    blockers: '',
    raw_message: message,
    parse_status: 'valid',
    parse_errors: '',
    discord_message_url: '',
    synced_at: postedAt,
    updated_at: postedAt,
  };
}

describe('Scrum weekly compliance', () => {
  it('tracks five expected days, the 10 PM cutoff, missed dates, and required format', () => {
    const records = [
      update('2026-09-05', '2026-09-05T14:00:00.000Z', 'Weekly Goals: Ship reports\nDaily Target: Build report\nAchievement: Completed export'),
      update('2026-09-06', '2026-09-06T17:30:00.000Z', 'Daily Target: Review data\nAchievement: Fixed mapping'),
    ];
    const result = getScrumCompliance(records, '2026-09-05', '2026-09-11', '2026-09-12');
    expect(result.updatesShared).toBe(2);
    expect(result.onTimeDays).toBe(1);
    expect(result.missedDates).toEqual(['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']);
    expect(result.weeklyGoalsShared).toBe(true);
    expect(result.formatMaintained).toBe(false);
  });

  it('does not mark the current day missed before the 10 PM deadline', () => {
    const result = getScrumCompliance([], '2026-09-05', '2026-09-07', '2026-09-07', 21 * 60);
    expect(result.dueDates).toEqual(['2026-09-05', '2026-09-06']);
  });

  it('removes Markdown heading markers from displayed text', () => {
    expect(plainScrumText('### Highlights\n**Strong delivery**')).toBe('Highlights\nStrong delivery');
  });

  it('reports per-update formatting and submission status', () => {
    const valid = update('2026-09-05', '2026-09-05T14:00:00.000Z', 'Daily Target: Build report\nAchievement: Completed export');
    const late = update('2026-09-05', '2026-09-05T17:00:00.000Z', 'Unstructured update');
    expect(hasDailyScrumFormat(valid)).toBe(true);
    expect(isScrumUpdateOnTime(valid)).toBe(true);
    expect(hasDailyScrumFormat(late)).toBe(false);
    expect(isScrumUpdateOnTime(late)).toBe(false);
  });
});
