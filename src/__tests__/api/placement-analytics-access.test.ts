import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/placement-analytics/route';

const mocks = vi.hoisted(() => ({ getPlacementAnalytics: vi.fn() }));

vi.mock('@/lib/placement-sync/sheets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/placement-sync/sheets')>('@/lib/placement-sync/sheets');
  return { ...actual, getPlacementAnalytics: mocks.getPlacementAnalytics };
});

const result = {
  selectedMonth: '2026-09',
  availableMonths: ['2026-09'],
  records: [],
  generatedAt: '2026-09-23T00:00:00.000Z',
};

function request(role?: 'manager' | 'mentor') {
  return new Request('https://app.test/api/placement-analytics', {
    headers: role ? {
      'x-user-id': `${role}-1`,
      'x-user-email': `${role}@example.com`,
      'x-user-name': role,
      'x-user-role': role,
    } : {},
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
  mocks.getPlacementAnalytics.mockResolvedValue(result);
});

afterEach(() => vi.unstubAllEnvs());

describe('placement analytics access', () => {
  it.each(['manager', 'mentor'] as const)('allows %s read-only dashboard access', async (role) => {
    const response = await GET(request(role));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ selectedMonth: '2026-09' });
  });

  it('rejects unauthenticated requests', async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
  });
});
