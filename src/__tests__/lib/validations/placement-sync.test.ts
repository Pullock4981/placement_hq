import { describe, expect, it } from 'vitest';
import { PlacementSyncSchema } from '@/lib/validators/placement-sync.schema';

const input = { fromDate: '2026-01-01', toDate: '2026-04-03', runId: 'b7e3f73a-a540-458c-a63f-746f1d8d8fb8' };

describe('placement date-range validation', () => {
  it('accepts the inclusive 93-day limit and early Discord snowflakes', () => {
    expect(PlacementSyncSchema.safeParse(input).success).toBe(true);
    expect(PlacementSyncSchema.safeParse({ ...input, cursor: '12345' }).success).toBe(true);
  });

  it.each([
    { toDate: '2026-04-04' },
    { toDate: '2025-12-31' },
    { fromDate: '2026-02-29' },
    { fromDate: '2014-12-31' },
    { fromDate: 'not-a-date' },
    { cursor: 12345 },
    { cursor: '-12345' },
    { runId: 'not-a-uuid' },
  ])('rejects invalid input %j', (change) => {
    expect(PlacementSyncSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });

  it('rejects a range that crosses annual placement workbooks', () => {
    const result = PlacementSyncSchema.safeParse({ ...input, fromDate: '2026-12-20', toDate: '2027-01-05' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('one calendar year'))).toBe(true);
  });
});
