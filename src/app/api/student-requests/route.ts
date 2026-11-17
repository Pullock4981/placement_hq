import { NextResponse } from 'next/server';
import { createStudentRequest, listStudentRequests } from '@/lib/student-requests/mock-store';
import { StudentRequestSchema } from '@/lib/validators/student-request.schema';

export async function GET() {
  return NextResponse.json({ data: listStudentRequests() });
}

export async function POST(request: Request) {
  const result = StudentRequestSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ message: 'Validation failed', errors: result.error.flatten().fieldErrors }, { status: 400 });
  }
  return NextResponse.json({ data: createStudentRequest(result.data) }, { status: 201 });
}
