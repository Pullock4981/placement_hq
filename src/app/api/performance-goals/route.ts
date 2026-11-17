import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { getDashboardMonthlyGoals } from '@/lib/performance/dashboard-goals-data';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager', 'mentor']);
    const month = new URL(request.url).searchParams.get('month') || new Date().toISOString().slice(0, 7);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ message: 'Invalid month.' }, { status: 400 });
    return NextResponse.json({ data: await getDashboardMonthlyGoals(month) }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } });
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message || 'Unable to load monthly goals.' }, { status: apiError.status || 500 });
  }
}
