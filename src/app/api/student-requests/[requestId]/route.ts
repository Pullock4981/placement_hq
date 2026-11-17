import { NextResponse } from 'next/server';
import { getStudentRequest, reviewStudentRequest, type StudentRequestStatus } from '@/lib/student-requests/mock-store';

const allowedStatuses: StudentRequestStatus[] = ['pending', 'under_review', 'changes_requested', 'approved', 'rejected'];

export async function GET(_: Request, { params }: { params: { requestId: string } }) {
  const request = getStudentRequest(params.requestId);
  if (!request) return NextResponse.json({ message: 'Request not found' }, { status: 404 });
  return NextResponse.json({ data: request });
}

export async function PATCH(request: Request, { params }: { params: { requestId: string } }) {
  const body = await request.json() as { status?: StudentRequestStatus; review_note?: string };
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ message: 'Invalid review status' }, { status: 400 });
  }
  const updated = reviewStudentRequest(params.requestId, body.status, body.review_note);
  if (!updated) return NextResponse.json({ message: 'Request not found' }, { status: 404 });
  return NextResponse.json({ data: updated });
}
