import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlacementTracker } from '@/components/placement-analytics/placement-tracker';
import { PlacementLeaderboard } from '@/components/placement-analytics/placement-leaderboard';
import { analyzePlacementMonth } from '@/lib/placement-analytics/analyze';
import { placementAnalyticsMock } from '@/lib/placement-analytics/mock-data';

const data = placementAnalyticsMock();
const setMonth = vi.fn();
const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/manager/placement/tracker' }));
vi.mock('@/components/placement-analytics/use-placement-analytics', () => ({ usePlacementAnalytics: () => hook.value }));

beforeEach(() => {
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  setMonth.mockReset();
  hook.value = { data, analysis: analyzePlacementMonth(data), month: data.selectedMonth, setMonth, isPending: false, isFetching: false, error: null };
});
afterEach(cleanup);

describe('placement analytics pages', () => {
  it('renders a documented monthly calendar with daily total and member counts', () => {
    render(<PlacementTracker />);
    expect(screen.getByRole('heading', { name: 'Monthly placement tracker' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Daily placement calendar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How this tracker is calculated' })).toBeInTheDocument();
    const activeDay = data.records[0].postedDate;
    const day = analyzePlacementMonth(data).days[Number(activeDay.slice(8)) - 1];
    const cell = screen.getByLabelText(`${day.date}: ${day.total} placements`);
    expect(cell).toHaveTextContent(String(day.total));
    day.mentors.forEach((mentor) => expect(cell).toHaveTextContent(mentor.name));
  });

  it('changes the reporting month without exposing a free-form date input', async () => {
    render(<PlacementTracker />);
    fireEvent.keyDown(screen.getByLabelText('Reporting month'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'July 2026' }));
    expect(setMonth).toHaveBeenCalledWith('2026-07');
  });

  it('renders podium and transparent ranking columns', () => {
    render(<PlacementLeaderboard />);
    expect(screen.getByRole('heading', { name: 'Placement leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Placement podium' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Full team ranking' })).toBeInTheDocument();
    expect(screen.getByText('Placements define rank')).toBeInTheDocument();
    expect(screen.getAllByText(data.records[0].mentorName).length).toBeGreaterThan(0);
  });

  it('filters the placement ranking by member name and shows a clear empty state', () => {
    render(<PlacementLeaderboard />);
    fireEvent.change(screen.getByPlaceholderText('Search team members…'), { target: { value: 'not-a-member' } });
    expect(screen.getByText('No team members found')).toBeInTheDocument();
  });

  it('shows safe loading and upstream failure states', () => {
    hook.value = { isPending: true };
    const { rerender } = render(<PlacementTracker />);
    expect(screen.getByLabelText('Loading placement tracker')).toBeInTheDocument();
    hook.value = { isPending: false, error: new Error('Safe analytics failure'), analysis: null, data: null };
    rerender(<PlacementTracker />);
    expect(screen.getByRole('alert')).toHaveTextContent('Safe analytics failure');
  });
});
