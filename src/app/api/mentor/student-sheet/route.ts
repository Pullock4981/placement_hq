import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { attachMentorStudentSheet, getMentorStudentWorkspace, listMentorStudentSheetConnections, updateMentorStudentStatus } from '@/lib/mentor-batch-sheets';
import { MentorStudentSheetAttachmentSchema, MentorStudentStatusUpdateSchema } from '@/lib/validators/mentor-student-sheet.schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 400;
  return NextResponse.json({ message: error instanceof Error ? error.message : 'Student Sheet is temporarily unavailable.' }, { status });
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    const data = user.role === 'admin'
      ? { connections: await listMentorStudentSheetConnections() }
      : await getMentorStudentWorkspace(user);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Only mentors can import a mentee sheet.' }, { status: 403 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Mentee sheet import is disabled in demo mode.' }, { status: 403 });
    const parsed = MentorStudentSheetAttachmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join('. ') }, { status: 400 });
    return NextResponse.json({ data: await attachMentorStudentSheet(user, parsed.data) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Only mentors can update their student sheet.' }, { status: 403 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Student status updates are disabled in demo mode.' }, { status: 403 });
    const parsed = MentorStudentStatusUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join('. ') }, { status: 400 });
    return NextResponse.json({ data: await updateMentorStudentStatus(user, parsed.data) });
  } catch (error) { return errorResponse(error); }
}
