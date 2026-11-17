import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { appendAuditLog } from '@/lib/sheets/audit';
import { addPerformancePlanComment, createPerformancePlan, listPerformancePlans, updateMonthlyKpi, updatePerformancePlanApproval } from '@/lib/performance/sheets';
import { MonthlyKpiUpdateSchema, PerformancePlanApprovalSchema, PerformancePlanCommentSchema, PerformancePlanCreateSchema } from '@/lib/validators/performance-plan.schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  return NextResponse.json({ message: status === 401 ? 'Sign in to manage performance plans.' : status === 403 ? 'You do not have access to performance plans.' : error instanceof Error ? error.message : 'Performance plans are temporarily unavailable.' }, { status });
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const month = new URL(request.url).searchParams.get('month') || undefined;
    if (month && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ message: 'Invalid month.' }, { status: 400 });
    return NextResponse.json({ data: await listPerformancePlans(user, month) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Performance plan writes are disabled in demo mode.' }, { status: 403 });
    const parsed = PerformancePlanCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join('. ') }, { status: 400 });
    const record = await createPerformancePlan(user, parsed.data);
    appendAuditLog({ user_email: user.email, actor_id: user.id, role: user.role, action: `performance.${record.type}.created`, entity_type: record.type, entity_id: record.id, payload: record, request }).catch((error) => console.error('[Performance] Audit log failed:', error));
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const body = await request.json().catch(() => null);
    const monthlyUpdate = MonthlyKpiUpdateSchema.safeParse(body);
    if (monthlyUpdate.success) return NextResponse.json({ data: await updateMonthlyKpi(user, monthlyUpdate.data) });
    const comment = PerformancePlanCommentSchema.safeParse(body);
    if (comment.success) return NextResponse.json({ data: await addPerformancePlanComment(user, comment.data) });
    const approval = PerformancePlanApprovalSchema.safeParse(body);
    if (approval.success) return NextResponse.json({ data: await updatePerformancePlanApproval(user, approval.data) });
    return NextResponse.json({ message: approval.error.issues.map((issue) => issue.message).join('. ') }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}
