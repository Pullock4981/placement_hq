import { describe, expect, it } from 'vitest';
import { ScrumSyncSchema } from '@/lib/validators/scrum-sync.schema';

const validInput = {
  fromDate: '2026-09-01',
  toDate: '2026-09-07',
  runId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
};

describe('ScrumSyncSchema', () => {
  it('accepts a same-year range of up to 93 days', () => {
    expect(ScrumSyncSchema.safeParse(validInput).success).toBe(true);
    expect(ScrumSyncSchema.safeParse({ ...validInput, fromDate: '2026-01-01', toDate: '2026-04-03' }).success).toBe(true);
  });

  it('rejects reverse, cross-year, and overlong ranges', () => {
    expect(ScrumSyncSchema.safeParse({ ...validInput, fromDate: '2026-09-08' }).success).toBe(false);
    expect(ScrumSyncSchema.safeParse({ ...validInput, fromDate: '2025-12-31' }).success).toBe(false);
    expect(ScrumSyncSchema.safeParse({ ...validInput, fromDate: '2026-01-01', toDate: '2026-04-04' }).success).toBe(false);
  });

  it('rejects impossible calendar dates and invalid cursors', () => {
    expect(ScrumSyncSchema.safeParse({ ...validInput, fromDate: '2026-02-30' }).success).toBe(false);
    expect(ScrumSyncSchema.safeParse({ ...validInput, cursor: 'not-a-snowflake' }).success).toBe(false);
  });
});
