import { describe, expect, it } from 'vitest';
import { formatScrumSummary } from '@/lib/scrum-sync/summary-format';
import { hasReportedBlocker, isWeeklyStatusUpdate } from '@/lib/scrum-sync/gemini';

describe('Scrum summary format', () => {
  it('enforces the weekly template, verified metrics, fallbacks, and signature', () => {
    const summary = formatScrumSummary([
      '### Highlights',
      '- Shipped placement reporting',
      '- Resolved student mapping issues',
      '- Reviewed company records',
      '### Goals & Achievement',
      '- **Goal:** An invented model goal',
      '### Blockers & Gaps',
      '- An invented blocker',
      '### Next Week Focus',
      '- Complete validation',
    ].join('\n'), {
      week: 35,
      fromDate: '2026-08-29',
      toDate: '2026-09-04',
      updates: 5,
      contributors: 1,
      activeDays: 5,
      blockers: 0,
      weeklyGoalsProvided: false,
    });
    expect(summary).toContain('# Week 35 Review');
    expect(summary).not.toContain('2026-08-29');
    expect(summary).toContain('### Goals & Achievement\n- **No specific goals provided.**');
    expect(summary).toContain('### Metrics\n- **Updates:** 5\n- **Contributors:** 1\n- **Active Days:** 5\n- **Blockers:** 0');
    expect(summary).toContain('### Blockers & Gaps\n- **No major blockers or gaps reported.**');
    expect(summary).toContain('*Prepared automatically by PlacementHQ Portal.*');
    expect(summary).not.toContain('\n\n\n###');
    expect(summary).not.toContain('invented model goal');
    expect(summary).not.toContain('invented blocker');
  });

  it('recognizes compact Thursday goal and achievement updates', () => {
    expect(isWeeklyStatusUpdate({
      update_date: '2026-09-03',
      raw_message: 'My Weekly goals were:\n- Interviews: 1\nMy Weekly Achievements:\n- Interviews: 1/1',
    })).toBe(true);
    expect(isWeeklyStatusUpdate({
      update_date: '2026-09-02',
      raw_message: 'My Weekly goals were:\n- Interviews: 1\nMy Weekly Achievements:\n- Interviews: 1/1',
    })).toBe(false);
  });

  it('does not count None followed by legacy appended sections as a blocker', () => {
    expect(hasReportedBlocker('None\nWeekly Reflection: Everything went smoothly')).toBe(false);
    expect(hasReportedBlocker('Electricity disruption delayed the assessment')).toBe(true);
  });
});
