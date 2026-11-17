'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyzePlacementMonth } from '@/lib/placement-analytics/analyze';
import { PlacementAnalyticsResponseSchema } from '@/lib/validators/placement-analytics.schema';
import type { PlacementAnalyticsResponse } from '@/lib/placement-analytics/types';

class PlacementAnalyticsRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PlacementAnalyticsRequestError';
  }
}

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit' }).format(new Date());
}

function cacheKey(month: string | null) {
  return `placementhq:placement-analytics:${month || 'latest'}`;
}

function readCached(month: string | null) {
  if (typeof window === 'undefined') return undefined;
  try {
    const parsed = PlacementAnalyticsResponseSchema.safeParse(JSON.parse(sessionStorage.getItem(cacheKey(month)) || 'null'));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function writeCached(month: string | null, data: PlacementAnalyticsResponse) {
  try {
    sessionStorage.setItem(cacheKey(month), JSON.stringify(data));
  } catch {}
}

function emptyResponse(month: string | null): PlacementAnalyticsResponse {
  const selectedMonth = month || currentMonth();
  return { selectedMonth, availableMonths: [selectedMonth], records: [], generatedAt: new Date().toISOString() };
}

export function usePlacementAnalytics() {
  const [month, setMonth] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['placement-analytics', month || 'latest'],
    queryFn: async ({ signal }) => {
      const path = `/api/placement-analytics${month ? `?month=${month}` : ''}`;
      let response = await fetch(path, { signal, credentials: 'same-origin' });
      if (response.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (refreshed.ok) response = await fetch(path, { signal, credentials: 'same-origin' });
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new PlacementAnalyticsRequestError(body?.message || 'Unable to load placement analytics.', response.status);
      const data = PlacementAnalyticsResponseSchema.parse(body);
      writeCached(month, data);
      writeCached(null, data);
      return data;
    },
    initialData: () => readCached(month),
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = query.data || readCached(month) || readCached(null) || emptyResponse(month);
  return {
    ...query,
    data,
    month: month || data.selectedMonth,
    setMonth,
    analysis: analyzePlacementMonth(data),
    isFallback: !query.data,
  };
}
