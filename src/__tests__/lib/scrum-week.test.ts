import { describe, expect, it } from 'vitest';
import { scrumCurrentWeek, scrumWeekRange } from '@/lib/scrum-sync/week';

describe('Scrum week helpers', () => {
  it('counts Saturday through Friday weeks', () => {
    expect(scrumCurrentWeek('2026-09-07')).toBe(36);
  });

  it('returns Saturday through Friday for a completed week', () => {
    expect(scrumWeekRange(2026, 35, '2026-09-07')).toEqual({ fromDate: '2026-08-29', toDate: '2026-09-04' });
  });

  it('stops the current week at today', () => {
    expect(scrumWeekRange(2026, 36, '2026-09-07')).toEqual({ fromDate: '2026-09-05', toDate: '2026-09-07' });
  });
});
