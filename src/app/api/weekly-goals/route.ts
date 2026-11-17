import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/helpers';
import { appendAuditLog } from '@/lib/sheets/audit';
import { addWeeklyGoalComment, createCurrentWeeklyGoals, getCurrentWeeklyGoals, getWeeklyGoalsForEmployee } from '@/lib/weekly-goals/sheets';
import { WeeklyGoalCommentSchema, WeeklyGoalsCreateSchema } from '@/lib/validators/weekly-goals.schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ManagerWeeklyGoalsQuery = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  week: z.coerce.number().int().min(1).max(53),
  employee: z.string().min(1).max(30),
  email: z.string().email().optional(),
});

function errorResponse(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  return NextResponse.json({ message: status === 401 ? 'Sign in to view weekly goals.' : status === 403 ? 'Weekly goals access is required.' : error instanceof Error ? error.message : 'Weekly goals are temporarily unavailable.' }, { status });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor', 'manager']);
    if (user.role === 'mentor') return NextResponse.json({ data: await getCurrentWeeklyGoals(user) }, { headers: { 'Cache-Control': 'no-store' } });
    if (user.role !== 'manager') return NextResponse.json({ message: 'Manager access is required.' }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const parsed = ManagerWeeklyGoalsQuery.safeParse({ year: params.get('year'), week: params.get('week'), employee: params.get('employee'), email: params.get('email') || undefined });
    if (!parsed.success) return NextResponse.json({ message: 'Choose a valid reporting week and employee.' }, { status: 400 });
    return NextResponse.json({ data: await getWeeklyGoalsForEmployee({ year: parsed.data.year, week: parsed.data.week, discordUserId: parsed.data.employee, email: parsed.data.email }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Mentor access is required.' }, { status: 403 });
    if (!sameOrigin(request)) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Weekly goal writes are disabled in demo mode.' }, { status: 403 });
    const parsed = WeeklyGoalsCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(' ') }, { status: 400 });
    const submission = await createCurrentWeeklyGoals(user, parsed.data.goals);
    appendAuditLog({ user_email: user.email, actor_id: user.id, role: user.role, action: 'weekly_goals.created', entity_type: 'weekly_goals', entity_id: submission.id, payload: { week_key: submission.week_key, goal_count: submission.goals.length }, request }).catch((error) => console.error('[Weekly goals] Audit log failed:', error));
    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Mentor access is required.' }, { status: 403 });
    if (!sameOrigin(request)) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Weekly goal writes are disabled in demo mode.' }, { status: 403 });
    const parsed = WeeklyGoalCommentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(' ') }, { status: 400 });
    return NextResponse.json({ data: await addWeeklyGoalComment(user, parsed.data.submission_id, parsed.data.note) });
  } catch (error) { return errorResponse(error); }
}
