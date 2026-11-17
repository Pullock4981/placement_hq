'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardMonthlyGoal } from '@/lib/performance/dashboard-goals';

export function useDashboardMonthlyGoals(month: string) {
  return useQuery<DashboardMonthlyGoal[]>({
    queryKey: ['dashboard-monthly-goals', month],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/performance-goals?month=${month}`, {
        signal,
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Unable to load monthly goals.');
      const payload = await response.json() as { data?: DashboardMonthlyGoal[] };
      return payload.data ?? [];
    },
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
