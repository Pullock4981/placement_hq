// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlacementDateRangePicker } from '@/components/placement/placement-date-range-picker';

function CalendarHarness({ today = '2026-08-31', disabled = false }: { today?: string; disabled?: boolean }) {
  const [range, setRange] = useState({ fromDate: today, toDate: today });
  return <>
    <PlacementDateRangePicker {...range} today={today} disabled={disabled} onChange={(fromDate, toDate) => setRange({ fromDate, toDate })} />
    <output aria-label="Selected range">{range.fromDate}|{range.toDate}</output>
  </>;
}

function day(name: RegExp) {
  return screen.getByRole('button', { name });
}

afterEach(cleanup);

describe('PlacementDateRangePicker', () => {
  it('replaces date inputs with a two-click inclusive range', () => {
    const { container } = render(<CalendarHarness />);
    expect(container.querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(day(/August 10th, 2026/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-10|');
    expect(screen.getByText('Now choose the end date')).toBeInTheDocument();
    fireEvent.click(day(/August 20th, 2026/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-10|2026-08-20');
    expect(screen.getByText('11 days selected · both dates included')).toBeInTheDocument();
    expect(day(/August 15th, 2026/).closest('td')).toHaveAttribute('aria-selected', 'true');
  });

  it('supports reversed ranges and starts a fresh range after completion', () => {
    render(<CalendarHarness />);
    fireEvent.click(day(/August 20th, 2026/));
    fireEvent.click(day(/August 10th, 2026/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-10|2026-08-20');
    fireEvent.click(day(/August 25th, 2026/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-25|');
  });

  it('selects a single day by clicking the same date twice', () => {
    render(<CalendarHarness />);
    fireEvent.click(day(/August 31st, 2026/));
    expect(screen.getByLabelText('Selected range').textContent).toBe('2026-08-31|');
    fireEvent.click(day(/August 31st, 2026/));
    expect(screen.getByText('1 day selected · both dates included')).toBeInTheDocument();
  });

  it('keeps the start date while navigating across months', () => {
    render(<CalendarHarness />);
    fireEvent.click(day(/August 28th, 2026/));
    fireEvent.click(day(/Go to the next month/i));
    fireEvent.click(day(/September 4th, 2026/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-28|2026-09-04');
    expect(screen.getByText('8 days selected · both dates included')).toBeInTheDocument();
  });

  it('allows 93 inclusive days and disables a 94th day', () => {
    render(<CalendarHarness today="2026-01-01" />);
    fireEvent.click(day(/January 1st, 2026/));
    for (let monthIndex = 0; monthIndex < 3; monthIndex += 1) {
      fireEvent.click(day(/Go to the next month/i));
    }
    expect(day(/April 4th, 2026/)).toBeDisabled();
    expect(day(/April 3rd, 2026/)).toBeEnabled();
    fireEvent.click(day(/April 3rd, 2026/));
    expect(screen.getByText('93 days selected · both dates included')).toBeInTheDocument();
  });

  it('limits reversed ranges to 93 inclusive days too', () => {
    render(<CalendarHarness today="2026-04-04" />);
    fireEvent.click(day(/April 4th, 2026/));
    for (let monthIndex = 0; monthIndex < 3; monthIndex += 1) {
      fireEvent.click(day(/Go to the previous month/i));
    }
    expect(day(/January 1st, 2026/)).toBeDisabled();
    fireEvent.click(day(/January 2nd, 2026/));
    expect(screen.getByText('93 days selected · both dates included')).toBeInTheDocument();
  });

  it('uses the supplied Dhaka date for presets without UTC day shifts', () => {
    render(<CalendarHarness today="2024-03-01" />);
    fireEvent.click(day(/^Last month$/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2024-02-01|2024-02-29');
    expect(screen.getByText('February 2024')).toBeInTheDocument();
    fireEvent.click(day(/^Last 7 days$/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2024-02-24|2024-03-01');
    fireEvent.click(day(/^Last 30 days$/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2024-02-01|2024-03-01');
    fireEvent.click(day(/^This month$/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2024-03-01|2024-03-01');
    fireEvent.click(day(/^Today$/));
    expect(day(/March 1st, 2024/)).toHaveAccessibleName(/Today/);
  });

  it('clears both endpoints', () => {
    render(<CalendarHarness />);
    fireEvent.click(day(/^Clear selection$/));
    expect(screen.getByLabelText('Selected range').textContent).toBe('|');
    expect(screen.getByText('Choose your first date')).toBeInTheDocument();
  });

  it('locks all range controls while a sync is busy or resumable', () => {
    render(<CalendarHarness disabled />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
    fireEvent.click(day(/^Last month$/));
    expect(screen.getByLabelText('Selected range')).toHaveTextContent('2026-08-31|2026-08-31');
  });

  it('prevents navigation before Discord history begins in 2015', () => {
    render(<CalendarHarness today="2015-01-01" />);
    expect(day(/Go to the previous month/i)).toBeDisabled();
  });
});
