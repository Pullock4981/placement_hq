import { describe, expect, it } from 'vitest';
import { DASHBOARD_REFLECTIONS } from '@/components/dashboard/dashboard-reflections';

describe('dashboard reflections', () => {
  it('contains at least 100 concise mixed reflections', () => {
    expect(DASHBOARD_REFLECTIONS.length).toBeGreaterThanOrEqual(100);
    expect(DASHBOARD_REFLECTIONS.some((item) => item.source.startsWith('Qur’an'))).toBe(true);
    expect(DASHBOARD_REFLECTIONS.some((item) => item.source.startsWith('Sahih'))).toBe(true);
    expect(DASHBOARD_REFLECTIONS.some((item) => item.source === 'William Shakespeare')).toBe(true);
    expect(DASHBOARD_REFLECTIONS.every((item) => item.text.length <= 100)).toBe(true);
  });
});
