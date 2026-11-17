import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiError, requireRole } from '@/lib/auth/helpers';
import { createScrumSummary, ScrumSummaryError } from '@/lib/scrum-sync/gemini';
import { getScrumDashboard, ScrumSheetsError } from '@/lib/scrum-sync/sheets';
import { scrumCurrentWeek, scrumWeekRange } from '@/lib/scrum-sync/week';
import { getWeeklyGoalsForEmployee } from '@/lib/weekly-goals/sheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SummaryRequestSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  week: z.number().int().min(1).max(53),
  employee: z.string().min(1).max(30),
});

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager']);
    if (user.role !== 'manager') throw createApiError('Forbidden', 403);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw createApiError('Cross-origin request', 403);
    const parsed = SummaryRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: 'Choose a valid week and employee.' }, { status: 400 });
    const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Dhaka', year: 'numeric' }).format(new Date()));
    if (parsed.data.year === currentYear && parsed.data.week > scrumCurrentWeek()) return NextResponse.json({ message: 'A future week cannot be summarized.' }, { status: 400 });
    const range = scrumWeekRange(parsed.data.year, parsed.data.week);
    const data = await getScrumDashboard({ year: parsed.data.year, ...range, employee: parsed.data.employee });
    if (!data.connectionReady || !data.sheetsReady) return NextResponse.json({ message: 'Initialize the annual Scrum workbook first.' }, { status: 409 });
    if (!data.records.length) return NextResponse.json({ message: 'No Scrum updates are available for this selection.' }, { status: 400 });
    const employee = data.employees.find((candidate) => candidate.id === parsed.data.employee);
    const employeeName = employee?.name || 'Selected employee';
    const weeklyGoals = await getWeeklyGoalsForEmployee({ year: parsed.data.year, week: parsed.data.week, discordUserId: parsed.data.employee, email: employee?.email }).then((result) => result.submission?.goals ?? []).catch((error) => {
      console.error('[Scrum Summary] Weekly goals could not be loaded; using final-day Scrum fallback:', error);
      return [];
    });
    return NextResponse.json({ summary: await createScrumSummary({ week: parsed.data.week, ...range, employeeName, records: data.records, weeklyGoals }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
    if (status === 401 || status === 403) return NextResponse.json({ message: status === 401 ? 'Sign in as a manager.' : 'Manager access is required.' }, { status });
    if (error instanceof ScrumSummaryError) return NextResponse.json({ message: error.message }, { status: error.code === 'NOT_CONFIGURED' ? 503 : 502 });
    if (error instanceof ScrumSheetsError) return NextResponse.json({ message: error.message }, { status: error.code === 'NOT_CONFIGURED' ? 503 : 502 });
    console.error('[Scrum Summary] Request failed:', error);
    return NextResponse.json({ message: 'The weekly Scrum summary could not be created.' }, { status: 502 });
  }
}
