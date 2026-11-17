// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { PlacementSyncPanel } from '@/components/placement/placement-sync-panel';
import { analyzePlacementMonth } from '@/lib/placement-analytics/analyze';
import { placementAnalyticsMock } from '@/lib/placement-analytics/mock-data';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
const analyticsHook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/components/placement-analytics/use-placement-analytics', () => ({ usePlacementAnalytics: () => analyticsHook.value }));

beforeEach(() => {
  const analyticsData = placementAnalyticsMock();
  analyticsHook.value = {
    data: analyticsData,
    analysis: analyzePlacementMonth(analyticsData),
    month: analyticsData.selectedMonth,
    setMonth: vi.fn(),
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({}),
  };
  vi.mocked(useQuery).mockReturnValue({
    data: {
      connectionReady: true, sheetsReady: true, discordConfigured: true,
      missingProperties: [], spreadsheetTitle: 'Placement Management', spreadsheetUrl: null,
      masterRows: 0, months: [], recentRecords: [], lastSync: null,
    },
    isPending: false, isFetching: false, error: null, refetch: vi.fn().mockResolvedValue({}),
  } as unknown as ReturnType<typeof useQuery>);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PlacementSyncPanel calendar integration', () => {
  it('shows a calendar skeleton while monthly placement data is loading', () => {
    analyticsHook.value = { ...analyticsHook.value, isFetching: true };
    render(<PlacementSyncPanel />);
    expect(screen.getByLabelText('Loading placement calendar')).toBeInTheDocument();
  });

  it('tests the server connection without starting a sync or passing credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ requestSucceeded: true, messagesChecked: 1, message: 'Discord history request succeeded from the Next.js server. No sheet data was changed.' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PlacementSyncPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Test Discord' }));
    expect(await screen.findByText('Discord history request succeeded from the Next.js server. No sheet data was changed.')).toHaveAttribute('role', 'status');
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/placement-sync', expect.objectContaining({ method: 'PATCH', credentials: 'same-origin' }));
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Sync to sheet' })).toBeEnabled();
  });

  it('shows the rate-limit wait without automatically retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'Discord rate limit reached.', retryAfter: 30 }, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PlacementSyncPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Test Discord' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait at least 30 seconds');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('prevents syncing an incomplete or cleared range', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<PlacementSyncPanel />);
    expect(screen.getByRole('button', { name: 'Sync to sheet' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Choose sync date range' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('button', { name: 'Sync to sheet', hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /\b1st, \d{4}/ }));
    expect(screen.getByRole('button', { name: 'Sync to sheet', hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sync to sheet', hidden: true }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /\b1st, \d{4}/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use selected range' }));
    expect(screen.getByRole('button', { name: 'Sync to sheet' })).toBeEnabled();
  });

  it('passes the selected calendar dates to sync and locks them during the request', async () => {
    let finishRequest!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finishRequest = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PlacementSyncPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Past 7 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sync to sheet' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(url).toBe('/api/placement-sync');
    expect(options.method).toBe('POST');
    expect(payload.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((Date.parse(payload.toDate) - Date.parse(payload.fromDate)) / 86400000).toBe(6);
    expect(screen.getByRole('button', { name: 'Choose sync date range' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Past 7 days' })).toBeDisabled();
    finishRequest(new Response(JSON.stringify({
      runId: payload.runId, fetched: 0, inserted: 0, updated: 0, unchanged: 0,
      invalid: 0, ignored: 0, complete: true, nextCursor: null,
    })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync to sheet' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Choose sync date range' })).toBeEnabled();
  });

  it('keeps a failed run locked until the manager chooses another range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection interrupted')));
    render(<PlacementSyncPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync to sheet' }));
    await screen.findByRole('button', { name: 'Resume sync' });
    expect(screen.getByRole('button', { name: 'Past 7 days' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Choose another range' }));
    expect(screen.getByRole('button', { name: 'Past 7 days' })).toBeEnabled();
  });
});
